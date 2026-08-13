const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    name: "via_crm_sid",
    secret: process.env.SESSION_SECRET || "via-crm-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Потрібна авторизація" });
  }
  next();
}

function normalizeCity(value) {
  return String(value || "").trim();
}

app.get("/api/routes", (req, res) => {
  res.json(db.getActiveRoutes());
});

app.post("/api/applications", (req, res) => {
  const fromCity = normalizeCity(req.body.from_city);
  const toCity = normalizeCity(req.body.to_city);
  const clientName = normalizeCity(req.body.client_name);
  const clientPhone = normalizeCity(req.body.client_phone);
  const clientEmail = normalizeCity(req.body.client_email);
  const comment = normalizeCity(req.body.comment);
  const tripDate = normalizeCity(req.body.trip_date);
  const passengers = Math.max(1, parseInt(req.body.passengers, 10) || 1);
  const routeId = req.body.route_id ? parseInt(req.body.route_id, 10) : null;

  if (!fromCity || !toCity || !clientName || !clientPhone) {
    return res.status(400).json({ error: "Заповніть обов'язкові поля" });
  }

  let route = routeId ? db.getRouteById(routeId) : db.findActiveRouteByCities(fromCity, toCity);
  if (route && route.active !== 1) route = null;

  if (!route) {
    return res.status(404).json({
      error: "Маршрут не знайдено. Оберіть напрямок зі списку доступних рейсів.",
    });
  }

  const application = db.createApplication({
    route_id: route.id,
    from_city: route.from_city,
    to_city: route.to_city,
    trip_date: tripDate,
    passengers,
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
    comment,
  });

  res.status(201).json({
    id: application.id,
    message: "Заявку надіслано! Ми зв'яжемося з вами найближчим часом.",
  });
});

app.post("/api/auth/login", (req, res) => {
  const username = normalizeCity(req.body.username);
  const password = String(req.body.password || "");

  const user = db.getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Невірний логін або пароль" });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ username: user.username });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Не авторизовано" });
  }
  res.json({ username: req.session.username });
});

app.get("/api/admin/routes", requireAuth, (req, res) => {
  res.json(db.getAllRoutes());
});

app.post("/api/admin/routes", requireAuth, (req, res) => {
  const fromCity = normalizeCity(req.body.from_city);
  const fromCountry = normalizeCity(req.body.from_country) || "Україна";
  const toCity = normalizeCity(req.body.to_city);
  const toCountry = normalizeCity(req.body.to_country) || "Німеччина";
  const price = parseFloat(req.body.price);
  const active = req.body.active === false || req.body.active === 0 ? 0 : 1;

  if (!fromCity || !toCity || Number.isNaN(price) || price <= 0) {
    return res.status(400).json({ error: "Заповніть міста та коректну ціну" });
  }

  const route = db.createRoute({
    from_city: fromCity,
    from_country: fromCountry,
    to_city: toCity,
    to_country: toCountry,
    price,
    active,
  });

  res.status(201).json(route);
});

app.put("/api/admin/routes/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.getRouteById(id);
  if (!existing) {
    return res.status(404).json({ error: "Маршрут не знайдено" });
  }

  const fromCity = normalizeCity(req.body.from_city) || existing.from_city;
  const fromCountry = normalizeCity(req.body.from_country) || existing.from_country;
  const toCity = normalizeCity(req.body.to_city) || existing.to_city;
  const toCountry = normalizeCity(req.body.to_country) || existing.to_country;
  const price = req.body.price !== undefined ? parseFloat(req.body.price) : existing.price;
  const active =
    req.body.active !== undefined
      ? req.body.active === false || req.body.active === 0
        ? 0
        : 1
      : existing.active;

  if (Number.isNaN(price) || price <= 0) {
    return res.status(400).json({ error: "Некоректна ціна" });
  }

  const route = db.updateRoute(id, {
    from_city: fromCity,
    from_country: fromCountry,
    to_city: toCity,
    to_country: toCountry,
    price,
    active,
  });

  res.json(route);
});

app.delete("/api/admin/routes/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.deleteRoute(id)) {
    return res.status(404).json({ error: "Маршрут не знайдено" });
  }
  res.json({ ok: true });
});

app.get("/api/admin/applications", requireAuth, (req, res) => {
  const status = normalizeCity(req.query.status) || null;
  res.json(db.getApplications(status));
});

app.patch("/api/admin/applications/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.getApplicationById(id);
  if (!existing) {
    return res.status(404).json({ error: "Заявку не знайдено" });
  }

  const allowed = ["new", "processing", "done", "cancelled"];
  const status = normalizeCity(req.body.status);
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Некоректний статус" });
  }

  res.json(db.updateApplicationStatus(id, status));
});

app.delete("/api/admin/applications/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.deleteApplication(id)) {
    return res.status(404).json({ error: "Заявку не знайдено" });
  }
  res.json({ ok: true });
});

app.use(express.static(__dirname));

app.get("/crm", (req, res) => {
  res.sendFile(path.join(__dirname, "crm", "index.html"));
});

app.listen(PORT, () => {
  console.log(`VIA сервер: http://localhost:${PORT}`);
  console.log(`CRM панель:  http://localhost:${PORT}/crm`);
  console.log(`Логін CRM:     admin / admin123`);
});
