"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpCircle,
  BookOpen,
  Coins,
  LifeBuoy,
  Library,
  MessageSquare,
  MoreHorizontal,
  Music2,
  PanelLeft,
  Star,
} from "lucide-react";
import { SITE } from "@/lib/site";
import { Avatar } from "./ProfileDialog";
import { useStudio } from "./StudioContext";

const NAV = [
  { href: "/", label: "Create", icon: Music2 },
  { href: "/library", label: "Library", icon: Library },
];

const COLLAPSE_KEY = "tuneo:sidebar-collapsed";

function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { artistName, setProfileOpen } = useStudio();
  const [collapsed, setCollapsed] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const load = () =>
      fetch("/api/credits")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setCredits(d.credits))
        .catch(() => {});
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () =>
        fetch("/api/update")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.update && setUpdate(d.update))
          .catch(() => {}),
      0,
    );
    return () => clearTimeout(t);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const item = (active: boolean) =>
    `flex h-12 items-center gap-3 rounded-full text-sm font-medium transition-colors duration-75 ${
      collapsed ? "w-12 justify-center" : "w-full px-4"
    } ${active ? "bg-white/10 text-fg" : "text-muted hover:bg-white/5 hover:text-fg"}`;

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-line bg-bg py-5 transition-[width] duration-200 md:flex ${
        collapsed ? "w-[72px] items-center px-3" : "w-[248px] px-3"
      }`}
    >
      <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between pl-4 pr-1"}`}>
        {!collapsed && (
          <Link href="/" className="whitespace-nowrap text-[26px] font-bold tracking-[-0.02em]">
            TuneO
          </Link>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
        >
          <PanelLeft size={17} />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={item(href === "/" ? pathname === "/" : pathname.startsWith(href))}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} />
            {!collapsed && label}
          </Link>
        ))}
        <button
          onClick={() => setProfileOpen(true)}
          className={item(false)}
          title={collapsed ? "Artist name" : undefined}
        >
          <Avatar name={artistName} size={20} />
          {!collapsed && <span className="truncate">{artistName || "Set artist name"}</span>}
        </button>
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {update && (
          <a
            href={update.url}
            target="_blank"
            rel="noreferrer"
            className={item(false)}
            title={`Update available: v${update.version}. Run: git pull && docker compose up -d --build`}
          >
            <ArrowUpCircle size={18} className="text-fg" />
            {!collapsed && <span className="truncate text-fg">Update to v{update.version}</span>}
          </a>
        )}
        <Link href="/credits" className={item(pathname === "/credits")} title="Credits and usage">
          <Coins size={18} />
          {!collapsed && (credits === null ? "Credits" : `${Math.floor(credits).toLocaleString()} credits`)}
        </Link>
        <MoreMenu collapsed={collapsed} item={item} />
        <a
          href={SITE.githubUrl || undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!SITE.githubUrl}
          title={SITE.githubUrl ? "Star TuneO on GitHub" : "GitHub link coming soon"}
          className={`mt-2 flex h-10 items-center justify-center gap-2 rounded-full border border-[#3a3a3f] text-sm font-medium hover:bg-hover ${
            collapsed ? "w-12" : "w-full"
          } ${SITE.githubUrl ? "" : "cursor-default opacity-70"}`}
        >
          {collapsed ? (
            <Star size={16} />
          ) : (
            <>
              <GithubMark /> Star on GitHub
            </>
          )}
        </a>
      </div>
    </aside>
  );
}

function MoreMenu({ collapsed, item }: { collapsed: boolean; item: (active: boolean) => string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const link = "flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover";
  const issues = SITE.githubUrl ? `${SITE.githubUrl}/issues` : undefined;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={item(open)}
        title={collapsed ? "More" : undefined}
      >
        <MoreHorizontal size={18} />
        {!collapsed && "More"}
      </button>
      {open && (
        <div
          className={`absolute bottom-full z-40 mb-2 w-56 overflow-hidden rounded-xl border border-line bg-bar py-1 shadow-2xl ${
            collapsed ? "left-0" : "left-2"
          }`}
        >
          <Link href="/help" onClick={() => setOpen(false)} className={link}>
            <LifeBuoy size={15} /> Help
          </Link>
          <Link href="/about" onClick={() => setOpen(false)} className={link}>
            <BookOpen size={15} /> About
          </Link>
          <a
            href={issues}
            target="_blank"
            rel="noreferrer"
            className={`${link} ${issues ? "" : "pointer-events-none text-dim"}`}
          >
            <MessageSquare size={15} /> Feedback
          </a>
          <div className="my-1 border-t border-line" />
          <div className="flex items-center justify-between px-4 py-2 text-xs text-dim">
            <span>v{SITE.version}</span>
            <a
              href={SITE.githubUrl || undefined}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className={SITE.githubUrl ? "text-muted hover:text-fg" : "pointer-events-none"}
            >
              <GithubMark size={15} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
