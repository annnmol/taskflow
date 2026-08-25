import React from "react";

function Footer() {
  return (
    <footer className="app-footer">
      <span>Built with ❤️ by Anmol Tanwar</span>
      <span>
        {" · "}
        <a
          href="https://github.com/annnmol/taskflow"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
        {" · "}
        <a
          href="https://linkedin.com/in/anmoltanwar"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn ↗
        </a>
      </span>
    </footer>
  );
}

export default Footer;
