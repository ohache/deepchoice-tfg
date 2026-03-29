import { Routes, Route } from "react-router-dom"
import { HomePage } from "@/features/home/HomePage"
import { PlayerShell } from "./features/player/PlayerShell"
import { EditorShell } from "./features/editor/pages/EditorShell"
import { ToastViewport } from "@/shared/toast/ToastViewport";

function App() {

  return (
    <>
      <ToastViewport />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<EditorShell />} />
        <Route path="/play" element={<PlayerShell />} />
      </Routes>
    </>
  )
}

export default App