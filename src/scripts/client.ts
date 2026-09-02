import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const widgets = [...document.querySelectorAll<HTMLElement>("[data-vote-widget]")];
const authButton = document.querySelector<HTMLButtonElement>("[data-auth-button]");
const authLabel = document.querySelector<HTMLElement>("[data-auth-label]");
let currentSession: Session | null = null;

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const staleBanner = document.querySelector<HTMLElement>("[data-latest-date]");
if (staleBanner && staleBanner.dataset.latestDate !== todayInShanghai()) staleBanner.hidden = false;

function setAuthState(session: Session | null) {
  currentSession = session;
  if (!authButton || !authLabel) return;
  if (!supabase) {
    authButton.disabled = true;
    authLabel.textContent = "投票待连接";
    authButton.title = "站点尚未连接 Supabase";
    return;
  }
  authButton.disabled = false;
  authLabel.textContent = session ? "退出登录" : "GitHub 登录";
  authButton.classList.toggle("is-authenticated", Boolean(session));
}

async function signInOrOut() {
  if (!supabase) return;
  if (currentSession) {
    await supabase.auth.signOut();
    return;
  }
  await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.href },
  });
}

authButton?.addEventListener("click", signInOrOut);

async function loadVotes() {
  if (!supabase || widgets.length === 0) return;
  const ids = widgets.map((widget) => widget.dataset.articleId).filter(Boolean) as string[];
  const [{ data: totals }, { data: ownVotes }] = await Promise.all([
    supabase.rpc("get_vote_totals", { article_ids: ids }),
    currentSession
      ? supabase.from("votes").select("article_id,vote").in("article_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const totalsById = new Map((totals ?? []).map((row: any) => [row.article_id, row]));
  const ownById = new Map((ownVotes ?? []).map((row: any) => [row.article_id, row.vote]));
  for (const widget of widgets) {
    const id = widget.dataset.articleId!;
    const total: any = totalsById.get(id);
    widget.querySelector<HTMLElement>("[data-up-count]")!.textContent = String(total?.up_count ?? 0);
    widget.querySelector<HTMLElement>("[data-down-count]")!.textContent = String(total?.down_count ?? 0);
    for (const button of widget.querySelectorAll<HTMLButtonElement>("[data-vote]")) {
      button.classList.toggle("is-selected", Number(button.dataset.vote) === ownById.get(id));
    }
  }
}

async function submitVote(widget: HTMLElement, vote: 1 | -1, reason: string | null = null) {
  const status = widget.querySelector<HTMLElement>("[data-vote-status]")!;
  if (!supabase || !currentSession) {
    status.textContent = "请先使用 GitHub 登录";
    await signInOrOut();
    return;
  }
  const articleId = widget.dataset.articleId!;
  const selected = widget.querySelector<HTMLButtonElement>(`[data-vote="${vote}"]`)?.classList.contains("is-selected");
  status.textContent = "保存中…";
  const result = selected
    ? await supabase.from("votes").delete().eq("article_id", articleId)
    : await supabase.from("votes").upsert(
        { article_id: articleId, user_id: currentSession.user.id, vote, reason },
        { onConflict: "article_id,user_id" },
      );
  status.textContent = result.error ? "保存失败，请稍后重试" : selected ? "已撤销" : "已记录";
  if (!result.error) await loadVotes();
}

for (const widget of widgets) {
  const picker = widget.querySelector<HTMLElement>("[data-reason-picker]")!;
  widget.querySelector<HTMLButtonElement>('[data-vote="1"]')?.addEventListener("click", () => submitVote(widget, 1));
  widget.querySelector<HTMLButtonElement>('[data-vote="-1"]')?.addEventListener("click", () => {
    if (widget.querySelector<HTMLButtonElement>('[data-vote="-1"]')?.classList.contains("is-selected")) {
      submitVote(widget, -1);
    } else {
      picker.hidden = false;
    }
  });
  widget.querySelector<HTMLButtonElement>("[data-confirm-down]")?.addEventListener("click", () => {
    const reason = widget.querySelector<HTMLSelectElement>("[data-reason]")?.value || null;
    picker.hidden = true;
    submitVote(widget, -1, reason);
  });
  widget.querySelector<HTMLButtonElement>("[data-cancel-down]")?.addEventListener("click", () => {
    picker.hidden = true;
  });
}

const filterRoot = document.querySelector<HTMLElement>("[data-category-filter]");
if (filterRoot) {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get("category") ?? "全部";
  const applyFilter = (category: string) => {
    for (const story of document.querySelectorAll<HTMLElement>("[data-category]")) {
      story.hidden = category !== "全部" && story.dataset.category !== category;
    }
    for (const section of document.querySelectorAll<HTMLElement>("[data-filter-section]")) {
      const stories = [...section.querySelectorAll<HTMLElement>("[data-category]")];
      section.hidden = stories.length > 0 && stories.every((story) => story.hidden);
    }
    for (const button of filterRoot.querySelectorAll<HTMLButtonElement>("[data-filter]")) {
      button.classList.toggle("is-active", button.dataset.filter === category);
    }
    const next = new URL(window.location.href);
    if (category === "全部") next.searchParams.delete("category");
    else next.searchParams.set("category", category);
    window.history.replaceState({}, "", next);
  };
  applyFilter(initial);
  filterRoot.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-filter]");
    if (button?.dataset.filter) applyFilter(button.dataset.filter);
  });
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    setAuthState(data.session);
    loadVotes();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    setAuthState(session);
    loadVotes();
  });
} else {
  setAuthState(null);
}
