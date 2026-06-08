import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireAdmin, RequireMember } from "./components/guards";
import Login from "./pages/Login";
import Home from "./pages/Home";
import BibleBooks from "./pages/BibleBooks";
import Reader from "./pages/Reader";
import Passage from "./pages/Passage";
import Threads from "./pages/Threads";
import Notes from "./pages/Notes";
import Profile from "./pages/Profile";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Reference from "./pages/Reference";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireMember />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/bible" element={<BibleBooks />} />
          <Route path="/read/:book/:chapter" element={<Reader />} />
          <Route path="/passage/:book/:chapter" element={<Passage />} />
          <Route path="/passage/:book/:chapter/:verse" element={<Passage />} />
          <Route path="/threads" element={<Threads />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/reference" element={<Reference />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
