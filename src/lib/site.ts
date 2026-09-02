export const site = {
  name: "十分钟前沿",
  description: "每天读懂 AI、科技与商业的重要变化",
  owner: "LuckygirlYali",
};

export function withBase(path = "/") {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}` || "/";
}
