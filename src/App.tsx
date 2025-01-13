import { useEffect, useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
// import { invoke } from "@tauri-apps/api/core";
import "./App.css";
// import {
//   BaseDirectory,
//   readTextFile,
//   writeTextFile,
// } from "@tauri-apps/plugin-fs";
import videojs from "video.js";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [serviceWorker, setServiceWorker] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  // useEffect(() => {
  //   createFile();
  //   readFile();
  //   // registerServiceWorker();
  // }, []);

  useEffect(() => {
    if (videoUrl) {
      const player = videojs(videoRef.current!, {
        controls: true,
        responsive: true,
        fluid: true,
      });
      console.log("videoUrl: ", videoUrl);

      player.src({ type: "application/x-mpegURL", src: videoUrl });
      return () => {
        if (player) {
          player.dispose(); // Clean up player instance on unmount
        }
      };
    }
  }, [videoUrl]);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    // setGreetMsg(await invoke("greet", { name }));
    const config = await fetch(
      "https://raw.githubusercontent.com/mdds-labs/vgm-release/main/config.json"
    );
    console.log("config: ", config);
  }

  const playVideo = async () => {
    // const urlPlay =
    //   "http://playertest.longtailvideo.com/adaptive/wowzaid3/playlist.m3u8";
    const urlPlay =
      "https://cdn.vgm.tv/ipfs/bafybeie65uuexn4xu2v5a5ibyvyyw6elvyp2levkjixv264itxn5uvw7mq/playlist.m3u8";
    setVideoUrl(urlPlay);
  };

  // const createFile = async () => {
  //   const contents = "Hello, World!";
  //   await writeTextFile("test.txt", contents, {
  //     baseDir: BaseDirectory.Document,
  //   });
  //   console.log("file created");
  // };
  // const readFile = async () => {
  //   const file = await readTextFile("test.txt", {
  //     baseDir: BaseDirectory.Document,
  //   });
  //   console.log("content: ", file);
  // };

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
      {/* <button onClick={registerServiceWorker}>Check</button> */}
      <hr></hr>
      <button onClick={playVideo}>Play Video</button>
      <p>{serviceWorker}</p>
      {videoUrl && (
        <div data-vjs-player>
          <video ref={videoRef} className="video-js vjs-default-skin" />
        </div>
      )}
    </main>
  );
}

export default App;
