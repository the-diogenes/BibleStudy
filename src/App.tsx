import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireAdmin, RequireGroup, RequireMember } from "./components/guards";
import Login from "./pages/Login";
import Home from "./pages/Home";
import BibleBooks from "./pages/BibleBooks";
import Bookmarks from "./pages/Bookmarks";
import Reader from "./pages/Reader";
import Passage from "./pages/Passage";
import Threads from "./pages/Threads";
import Notes from "./pages/Notes";
import Groups from "./pages/Groups";
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
          {/* Personal / always-available pages (no group required). */}
          <Route path="/bible" element={<BibleBooks />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/read/:book/:chapter" element={<Reader />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/reference" element={<Reference />} />
          {/* Group-scoped pages. */}
          <Route element={<RequireGroup />}>
            <Route path="/" element={<Home />} />
            <Route path="/passage/:book/:chapter" element={<Passage />} />
            <Route path="/passage/:book/:chapter/:verse" element={<Passage />} />
            <Route path="/threads" element={<Threads />} />
            <Route path="/notes" element={<Notes />} />
          </Route>
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
