// Edit this list to change what shows up on signs in the 3D lot
// and in the plain-list fallback below it.
// `link`: set this to each project's live URL or GitHub repo — the
// "View project" button only appears when this isn't empty.
const PROJECTS = [
  {
    name: "LogiSphere AI",
    stop: "Stop 01",
    color: 0xf2b705,
    desc: "A logistics management platform where AI agents handle planning, risk classification and customer communication end-to-end — while every financial action still runs through a deterministic, human-approved backend.",
    stack: ["Vue 3", "Flask", "Supabase", "HuggingFace", "Leaflet.js"],
    note: "Built for the Highrise Hackathon (Trade & Logistics track), now being rebuilt into a full product.",
    link: "https://logicsphere-gold.vercel.app/"
  },
  {
    name: "StudyDeck AI",
    stop: "Stop 02",
    color: 0x3eb1c8,
    desc: "A Flutter flashcard app with AI-assisted deck generation, TOTP-based multi-factor auth, and social deck-sharing via 8-character share codes.",
    stack: ["Flutter", "Supabase", "HuggingFace"],
    note: "Prepared for beta testing and Google Play deployment.",
    link: ""
  },
  {
    name: "Ministry Reporting System",
    stop: "Stop 03",
    color: 0xe8563a,
    desc: "An internal system for the Ministry of Culture, Gender, Entertainment and Sport that migrates a legacy Excel-based database into a relational one, paired with a dynamic form-based report collection tool.",
    stack: ["Flask", "Vue 3", "Azure"],
    note: "Built during my Data & Performance Analyst internship.",
    link: ""
  },
  {
    name: "VLEclone",
    stop: "Stop 04",
    color: 0x9b8cf2,
    desc: "A university Virtual Learning Environment clone with role-based access for students, lecturers and admins — forums, assignments, grading, calendar events and admin reporting.",
    stack: ["Vue 3", "Flask", "MySQL"],
    note: "Third-year coursework project, deployed to Render.",
    link: ""
  },
  {
    name: "DriftDater",
    stop: "Stop 05",
    color: 0x6bd08a,
    desc: "A dating app with a custom matching algorithm and session-based authentication, built as a group project and deployed live.",
    stack: ["Flask", "Vue.js", "PostgreSQL"],
    note: "Group project for INFO3180, deployed to Render.",
    link: ""
  }
];

