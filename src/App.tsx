import { Routes, Route } from "react-router-dom"
import { HomePage } from "@/features/home/HomePage"
import { PlayerShell } from "./features/player/PlayerShell"
import { EditorShell } from "./features/editor/pages/EditorShell"

function App() {

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorShell />} />
      <Route path="/play" element={<PlayerShell />} />
    </Routes>
  )
}

export default App