const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const STORE_PATH = process.env.STORE_PATH || path.join(DATA_DIR, "store.json");

const SEED_ROUTES = [
  { from_city: "Львів", from_country: "Україна", to_city: "Халле", to_country: "Німеччина", price: 110 },
  { from_city: "Київ", from_country: "Україна", to_city: "Фрайбург", to_country: "Німеччина", price: 140 },
  { from_city: "Київ", from_country: "Україна", to_city: "Гамбург", to_country: "Німеччина", price: 120 },
  { from_city: "Харків", from_country: "Україна", to_city: "Лейпциг", to_country: "Німеччина", price: 135 },
  { from_city: "Харків", from_country: "Україна", to_city: "Гіссен", to_country: "Німеччина", price: 155 },
  { from_city: "Львів", from_country: "Україна", to_city: "Фрайбург", to_country: "Німеччина", price: 130 },
  { from_city: "Київ", from_country: "Україна", to_city: "Оффенбург", to_country: "Німеччина", price: 140 },
  { from_city: "Харків", from_country: "Україна", to_city: "Леррах", to_country: "Німеччина", price: 160 },
  { from_city: "Полтава", from_country: "Україна", to_city: "Франкфурт", to_country: "Німеччина", price: 155 },
];

function nowIso() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    users: [],
    routes: [],
    applications: [],
    _counters: { users: 0, routes: 0, applications: 0 },
  };
}

function loadStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(STORE_PATH)) {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    ensureAdminUser(parsed);
    return parsed;
  }

  const bundledStore = path.join(__dirname, "data", "store.json");
  if (bundledStore !== STORE_PATH && fs.existsSync(bundledStore)) {
    const parsed = JSON.parse(fs.readFileSync(bundledStore, "utf8"));
    saveStore(parsed);
    return parsed;
  }

  const store = emptyStore();
  store.users.push({
    id: 1,
    username: "admin",
    password_hash: bcrypt.hashSync("admin123", 10),
    created_at: nowIso(),
  });
  store._counters.users = 1;

  SEED_ROUTES.forEach((route) => {
    store._counters.routes += 1;
    store.routes.push({
      id: store._counters.routes,
      ...route,
      active: 1,
      created_at: nowIso(),
    });
  });

  saveStore(store);
  return store;
}

function ensureAdminUser(store) {
  if (!store._counters) {
    store._counters = { users: 0, routes: 0, applications: 0 };
  }
  if (!Array.isArray(store.users)) store.users = [];
  if (!store.users.some((u) => u.username === "admin")) {
    store._counters.users += 1;
    store.users.push({
      id: store._counters.users,
      username: "admin",
      password_hash: bcrypt.hashSync("admin123", 10),
      created_at: nowIso(),
    });
  }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

let store = loadStore();

function persist() {
  saveStore(store);
}

function nextId(key) {
  store._counters[key] += 1;
  return store._counters[key];
}

function getActiveRoutes() {
  return store.routes
    .filter((r) => r.active === 1)
    .map(({ id, from_city, from_country, to_city, to_country, price }) => ({
      id,
      from_city,
      from_country,
      to_city,
      to_country,
      price,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getAllRoutes() {
  return [...store.routes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getRouteById(id) {
  return store.routes.find((r) => r.id === id) || null;
}

function findActiveRouteByCities(fromCity, toCity) {
  const from = fromCity.trim().toLowerCase();
  const to = toCity.trim().toLowerCase();
  return (
    store.routes.find(
      (r) =>
        r.active === 1 &&
        r.from_city.toLowerCase() === from &&
        r.to_city.toLowerCase() === to
    ) || null
  );
}

function createRoute(data) {
  const route = {
    id: nextId("routes"),
    from_city: data.from_city,
    from_country: data.from_country,
    to_city: data.to_city,
    to_country: data.to_country,
    price: data.price,
    active: data.active ?? 1,
    created_at: nowIso(),
  };
  store.routes.push(route);
  persist();
  return route;
}

function updateRoute(id, data) {
  const route = getRouteById(id);
  if (!route) return null;
  Object.assign(route, data);
  persist();
  return route;
}

function deleteRoute(id) {
  const index = store.routes.findIndex((r) => r.id === id);
  if (index === -1) return false;
  store.routes.splice(index, 1);
  persist();
  return true;
}

function getUserByUsername(username) {
  return store.users.find((u) => u.username === username) || null;
}

function createApplication(data) {
  const app = {
    id: nextId("applications"),
    route_id: data.route_id,
    from_city: data.from_city,
    to_city: data.to_city,
    trip_date: data.trip_date || null,
    passengers: data.passengers,
    client_name: data.client_name,
    client_phone: data.client_phone,
    client_email: data.client_email || null,
    comment: data.comment || null,
    status: "new",
    created_at: nowIso(),
  };
  store.applications.push(app);
  persist();
  return app;
}

function withRoutePrice(app) {
  const route = app.route_id ? getRouteById(app.route_id) : null;
  return {
    ...app,
    route_price: route ? route.price : null,
  };
}

function getApplications(status) {
  let list = [...store.applications];
  if (status) {
    list = list.filter((a) => a.status === status);
  }
  return list
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(withRoutePrice);
}

function getApplicationById(id) {
  const app = store.applications.find((a) => a.id === id);
  return app ? withRoutePrice(app) : null;
}

function updateApplicationStatus(id, status) {
  const app = store.applications.find((a) => a.id === id);
  if (!app) return null;
  app.status = status;
  persist();
  return withRoutePrice(app);
}

function deleteApplication(id) {
  const index = store.applications.findIndex((a) => a.id === id);
  if (index === -1) return false;
  store.applications.splice(index, 1);
  persist();
  return true;
}

module.exports = {
  getActiveRoutes,
  getAllRoutes,
  getRouteById,
  findActiveRouteByCities,
  createRoute,
  updateRoute,
  deleteRoute,
  getUserByUsername,
  createApplication,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
};
