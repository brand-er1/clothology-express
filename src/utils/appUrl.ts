const normalizedBasePath = import.meta.env.BASE_URL === "/"
  ? ""
  : import.meta.env.BASE_URL.replace(/\/$/, "");

export const routerBasename = normalizedBasePath || undefined;

export const getAppPath = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBasePath}${normalizedPath}` || "/";
};

export const getAppUrl = (path = "/") =>
  new URL(getAppPath(path), window.location.origin).toString();
