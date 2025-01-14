const sw = self as unknown & typeof globalThis;

// let decrypt: any;
// import("vgm-decrypt")
//   .then((res) => {
//     decrypt = res.decrypt;
//   })
//   .catch((e) => console.error("Error importing `vgm-decrypt`:", e));
import pAny from "p-any";
import { pipe, evolve, map } from "ramda";
const cacheName = "VgmCache_v1";
let config: any;
let IVs: any = [];

sw.addEventListener("install", (event: any) => {
    console.log("Service Worker installing::", event);
    event.target.skipWaiting();
    // event.waitUntil(event.target.skipWaiting());
    // event.waitUntil(
    //   caches.open('v1').then((cache) => {
    //     return cache.addAll(['./', './index.html']);
    //   })
    // );
});

sw.addEventListener("activate", async (event: any) => {
    config = await fetch(
        "https://raw.githubusercontent.com/mdds-labs/vgm-release/main/config.json"
    );
    console.log("Service Worker activated::", event);
    // event.waitUntil(event.target.clients.claim());
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function (cacheName) {
                        // Return true if you want to remove this cache,
                        // but remember that caches are shared across
                        // the whole origin
                        return true;
                    })
                    .map(function (cacheName) {
                        return caches.delete(cacheName);
                    })
            );
        })
    );
});

sw.addEventListener("notificationclick", (event: any) => {
    event.notification.close();
    // console.log('notification details from SW: ', event.notification);
});

sw.addEventListener("fetch", async (event: any) => {
    // If the request in GET, let the network handle things,
    const requestUrl: any = new URL(event.request.url);
    if (!requestUrl.protocol.startsWith("http")) return;
    if (event.request.method !== "GET" && event.request.method !== "HEAD") return;
    if (event.request.method === "HEAD") {
        const key = requestUrl.pathname;
        const ab: any = await abFromIDB(key);
        // console.log("event::", event.request.url);
        if (ab && ab.data && ab.data.byteLength > 1000) {
            return new Response("", { status: 200, statusText: "Ok" });
        }
        return;
    }
    if (
        !/(\.m3u8)$|(\.vgmx)$|(\.vgmk)$|(\.jpg)$|(\.jpeg)$|(\.webp)$|(\.json)$/.test(
            requestUrl.href
        )
    ) {
        event.respondWith(
            (async () => {
                if (event.request.url.includes("ipns")) {
                    return fetch(event.request);
                } else {
                    return caches.open(cacheName).then((cache) => {
                        return cache.match(event.request).then((cachedResponse) => {
                            const fetchedResponse = fetch(event.request)
                                .then((networkResponse) => {
                                    cache.put(event.request, networkResponse.clone());
                                    return networkResponse;
                                })
                                .catch((err) => undefined);
                            return cachedResponse || fetchedResponse;
                        });
                    });
                }
            })()
        );
    } else {
        event.respondWith(
            // console.log('Service Worker fetching. \n', requestUrl.href, response)
            // Returns a promise of the cache entry that matches the request
            (async () => {
                //  if data stored in indexeddb for offline mode, let's return that instead
                if (
                    /(\.m3u8)$|(\.vgmx)$|(\.vgmk)$|(\.jpg)$|(\.jpeg)$|(\.webp)$/.test(
                        requestUrl.href
                    )
                ) {
                    // Check if data in IDB
                    const key = requestUrl.pathname;
                    const ab: any = await abFromIDB(key);
                    // console.log('fetching img', requestUrl.href, ab);
                    if (ab && ab.data && ab.data.byteLength > 1000) {
                        return new Response(ab.data, {
                            status: 200,
                            statusText: "Ok",
                        });
                    }
                    // If data not in IDB, let's fetch it
                    const response = await fetchTimeout(requestUrl.href, 5000);
                    let fetchResponse = response;
                    if (response && response.type === "opaque") {
                        fetchResponse = await fetchTimeout(requestUrl.href, 5000);
                    }
                    if (fetchResponse && fetchResponse.status === 200) {
                        // Handle vgmk
                        if (
                            /(\d+p\.m3u8)$/.test(requestUrl.href) &&
                            !/iPhone|iPad|iPod/i.test(navigator.userAgent)
                        ) {
                            let cloneResponse = fetchResponse.clone();
                            const key = requestUrl.pathname.split("/")[2];
                            const IV = await cloneResponse
                                .text()
                                .then((str: any) => {
                                    return str
                                        .match(/(IV=0x).+/)
                                        .toString()
                                        .replace("IV=0x", "")
                                        .slice(0, 4);
                                })
                                .catch((err) => "");
                            pushIfNotExist(IVs, { key: key, iv: IV });
                            return fetchResponse;
                        }

                        // Handle vgmk
                        if (
                            /(\.vgmk)$/.test(requestUrl.href) &&
                            !isIOSVersionGreaterThan(17, 4, 1)
                        ) {
                            let cloneResponse = fetchResponse.clone();
                            console.log("cloneResponse::", cloneResponse);
                            return await alterResponse(cloneResponse, requestUrl.href);
                        }
                        // Handle vgmx
                        if (/(\.vgmx)$/.test(requestUrl.href)) {
                            const prefetchThreshold = 20;
                            const key = requestUrl.pathname.split("/")[2];
                            const ab: any = await abFromIDB(key);
                            let playingSegment = ab && ab.data ? parseInt(ab.data) : 0;
                            const segment = parseInt(
                                requestUrl.pathname.split("/").pop().match(/\d+/)[0]
                            );
                            playingSegment = segment === 0 ? 0 : playingSegment;
                            if (
                                segment === 0 ||
                                playingSegment === 0 ||
                                Math.abs(playingSegment - segment) > prefetchThreshold + 10
                            ) {
                                abToIDB(key, segment + prefetchThreshold);
                            } else if (segment === playingSegment - 10) {
                                abToIDB(key, playingSegment + prefetchThreshold);
                                prefetch(requestUrl.href);
                            }
                            // console.log('vgmx::', key, segment, playingSegment);
                            return fetchResponse;
                        }
                        // Handle images
                        if (/(\.jpg)$|(\.jpeg)$|(\.webp)$/.test(requestUrl.href)) {
                            // console.log('webp response:', fetchResponse);
                            const imgBuff = await fetchResponse.clone().arrayBuffer();
                            // console.log('got img buff', imgBuff);
                            if (imgBuff && imgBuff.byteLength > 1000) {
                                const key = requestUrl.href
                                    .replace(/.*(?=\/encrypted\/.*)/, "")
                                    .replace(/.*(?=\/ipfs\/.*)/, "");
                                abToIDB(key, imgBuff);
                            }
                            return fetchResponse;
                        }
                        return fetchResponse;
                    }
                    if (config && config.fallback_gateway) {
                        // Handle fail requests here
                        let ipfsPath = requestUrl.href.replace(/https?:\/\/[^\/]+/, "");
                        if (/(\.jpg)$|(\.jpeg)$|(\.webp)$/.test(ipfsPath)) {
                            const dirName = ipfsPath.match(/.+\//).toString();
                            const fileName = ipfsPath
                                .match(/(?!.*\/).+/)
                                .toString()
                                .replace(/\d+/, 1);
                            ipfsPath = `${dirName}${fileName}`;
                            // console.log("refetch image::", ipfsPath);
                        }
                        const buildFetcher = pipe(
                            map((gateway) => `${gateway}${ipfsPath}`),
                            map((url) => {
                                return fetch(url);
                            })
                        );
                        const result: any = await pAny(
                            buildFetcher(config.fallback_gateway)
                        );
                        if (
                            /(\.jpg)$|(\.jpeg)$|(\.webp)$/.test(ipfsPath) &&
                            result &&
                            result.status === 200
                        ) {
                            const imgBuff = await result.clone().arrayBuffer();
                            const key = requestUrl.href
                                .replace(/.*(?=\/encrypted\/.*)/, "")
                                .replace(/.*(?=\/ipfs\/.*)/, "");
                            abToIDB(key, imgBuff);
                        }
                        return result;
                    }
                    return fetchResponse;
                } else {
                    return await fetch(requestUrl.href);
                }
            })()
        );
    }
    //   here we block the request and handle it our selves
    event.stopImmediatePropagation();
});

const fetchTimeout = async (
    url: string,
    timeout: number = 2000,
    method = "GET"
) => {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
            method: method,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        return new Response("", { status: 408, statusText: "Response Timeout" });
    }
};

const abFromIDB = async function (key: any) {
    let request = indexedDB.open("OfflineDB", 10);
    return new Promise(async (resolve) => {
        // request.onerror = async (e) => {
        //   console.log('IDB not available');
        // };
        request.onsuccess = async (e: any) => {
            let db = request.result;
            let tx = db.transaction("data", "readwrite");
            let store = tx.objectStore("data").get(key);
            store.onsuccess = function (e: any) {
                // console.log('ab from IDB:', key);
                resolve(e.target.result);
            };
        };
    });
};
// Function to store image data to IDB
const abToIDB = async function (key: any, data: any) {
    let request = indexedDB.open("OfflineDB", 10);
    return new Promise(async (resolve) => {
        request.onerror = async (e) => {
            console.log("IDB not available");
        };
        request.onsuccess = async (e) => {
            let db = request.result;
            let tx: any = db.transaction("data", "readwrite");
            let store = tx.objectStore("data");

            // console.log('Putting to IDB:: ', uri, data);
            store.put({ uri: key, data: data });
            resolve(tx.complete);
        };
    });
};

const prefetch = function (url: string) {
    const dir = url.substring(0, url.lastIndexOf("/"));
    const filename = url.split("/").pop() || "";
    const playingSegment = filename.match(/\d+/)?.[0];
    if (!playingSegment) return;
    // console.log('prefetch from SW called::', url, dir, filename);
    for (let i = 0; i < 20; i++) {
        const fetchSegment = `${parseInt(playingSegment) + i + 1}`;
        const prefetchUrl = `${dir}/${filename.replace(/\d+/, fetchSegment)}`;
        // console.log('prefetching::', prefetchUrl);
        setTimeout(() => {
            fetch(prefetchUrl);
        }, 250 * i);
    }
};

const deepEqual = function (obj1: any, obj2: any) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
};

const pushIfNotExist = function (array: any[], element: { key: any; iv: any }) {
    const exists = array.some((el) => deepEqual(el, element));
    if (!exists) {
        array.push(element);
    }
};

const iOSVersion = function () {
    var userAgent = navigator.userAgent;
    var iosRegex = /iP(hone|od|ad).*? OS (\d+)_?(\d+)?_?(\d+)?/;
    var match = userAgent.match(iosRegex);

    if (match) {
        var majorVersion = parseInt(match[2], 10);
        var minorVersion = match[3] ? parseInt(match[3], 10) : 0;
        var patchVersion = match[4] ? parseInt(match[4], 10) : 0;
        return {
            major: majorVersion,
            minor: minorVersion,
            patch: patchVersion,
        };
    } else {
        return null;
    }
};
const isIOSVersionGreaterThan = function (
    targetMajor: number,
    targetMinor: number,
    targetPatch: number
) {
    var iosVersion = iOSVersion();
    if (!iosVersion) {
        return false; // Not an iOS device or unable to detect iOS version.
    }

    if (iosVersion.major > targetMajor) {
        return true;
    } else if (iosVersion.major === targetMajor) {
        if (iosVersion.minor > targetMinor) {
            return true;
        } else if (iosVersion.minor === targetMinor) {
            if (iosVersion.patch > targetPatch) {
                return true;
            }
        }
    }
    return false;
};

const alterResponse = async function (response: Response, url: string | URL) {
    const requestUrl: any = new URL(url);
    const key = requestUrl.pathname.split("/")[2];
    // console.log("key::::", url, key);

    try {
        // const ab = await abFromIDB(url);
        // if (ab) {
        //   const keyBuff = await new Uint8Array(ab.data);
        //   // console.log('VGMK from DB', url);
        //   return new Response(keyBuff, { status: 200, statusText: 'Ok' });
        // } else {
        const resClone = response.clone();
        const keyBuff: Uint8Array = await resClone
            .arrayBuffer()
            .then((ab) => new Uint8Array(ab));
        console.log("newKeyBuff", keyBuff);
        const fileFolder = url.toString().replace(/key\.vgmk$/, "");
        const quality = ["480p", "128p", "720p", "1080p"];
        let m3u8Blob;
        let IV;

        const ivIndex = IVs.findIndex((item: any) => item.key === key);
        // console.log("ivIndex::", ivIndex, IVs[ivIndex]);
        if (ivIndex >= 0) {
            IV = IVs[ivIndex].iv;
        } else {
            const fetch_retry = async (n: number) => {
                let error;
                for (let i = 0; i < n; i++) {
                    try {
                        const filePath = `${fileFolder}${quality[i]}.m3u8`;
                        const fetchResult = await fetch(filePath);
                        if (fetchResult.status === 200) return fetchResult;
                    } catch (err) {
                        error = err;
                    }
                }
                console.log(error);
            };
            m3u8Blob = await fetch_retry(quality.length);
            console.log("got m3u8", m3u8Blob);

            if (m3u8Blob) {
                IV = await m3u8Blob.text().then(function (str) {
                    if (!str) return "";
                    const match = str.match(/(IV=0x).+/);
                    if (!match) return "";
                    return match.toString().replace("IV=0x", "").slice(0, 4);
                });
            }
            console.log("for IV", IV, m3u8Blob);
        }

        // decrypt with wasm
        if (IV) {
            // await wasm_bindgen('./custom.wasm');
            // const newBuff = wasm_bindgen.decrypt(keyBuff, IV, false);
            // console.log("decrypt::", keyBuff, IV, false);
            // const newBuff = decrypt(keyBuff, IV, false);
            // console.log('newBuff from WASM', newBuff);IV
            return new Response(keyBuff, { status: 200, statusText: "Ok" });
        } else {
            return resClone;
        }
        // }
    } catch (error) {
        console.log("error", error);
        return response;
    }
};
