const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.use(express.json());
app.use(
  session({
    name: "via_crm_sid",
    secret: process.env.SESSION_SECRET || "via-crm-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "lax",
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

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/routes", (req, res) => {
  try {
    res.json(db.getActiveRoutes());
  } catch (err) {
    console.error("GET /api/routes:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.post("/api/applications", (req, res) => {
  try {
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
      return sendError(res, 400, "Заповніть обов'язкові поля");
    }

    let route = routeId ? db.getRouteById(routeId) : db.findActiveRouteByCities(fromCity, toCity);
    if (route && route.active !== 1) route = null;

    if (!route) {
      return sendError(res, 404, "Маршрут не знайдено. Оберіть напрямок зі списку доступних рейсів.");
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
  } catch (err) {
    console.error("POST /api/applications:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const username = normalizeCity(req.body.username);
    const password = String(req.body.password || "");

    const user = db.getUserByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return sendError(res, 401, "Невірний логін або пароль");
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return sendError(res, 500, "Помилка сесії");
      }
      res.json({ username: user.username });
    });
  } catch (err) {
    console.error("POST /api/auth/login:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) {
    return sendError(res, 401, "Не авторизовано");
  }
  res.json({ username: req.session.username });
});

app.get("/api/admin/routes", requireAuth, (req, res) => {
  try {
    res.json(db.getAllRoutes());
  } catch (err) {
    console.error("GET /api/admin/routes:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.post("/api/admin/routes", requireAuth, (req, res) => {
  try {
    const fromCity = normalizeCity(req.body.from_city);
    const fromCountry = normalizeCity(req.body.from_country) || "Україна";
    const toCity = normalizeCity(req.body.to_city);
    const toCountry = normalizeCity(req.body.to_country) || "Німеччина";
    const price = parseFloat(req.body.price);
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;

    if (!fromCity || !toCity || Number.isNaN(price) || price <= 0) {
      return sendError(res, 400, "Заповніть міста та коректну ціну");
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
  } catch (err) {
    console.error("POST /api/admin/routes:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.put("/api/admin/routes/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.getRouteById(id);
    if (!existing) {
      return sendError(res, 404, "Маршрут не знайдено");
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
      return sendError(res, 400, "Некоректна ціна");
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
  } catch (err) {
    console.error("PUT /api/admin/routes:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.delete("/api/admin/routes/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!db.deleteRoute(id)) {
      return sendError(res, 404, "Маршрут не знайдено");
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/routes:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.get("/api/admin/applications", requireAuth, (req, res) => {
  try {
    const status = normalizeCity(req.query.status) || null;
    res.json(db.getApplications(status));
  } catch (err) {
    console.error("GET /api/admin/applications:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.patch("/api/admin/applications/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.getApplicationById(id);
    if (!existing) {
      return sendError(res, 404, "Заявку не знайдено");
    }

    const allowed = ["new", "processing", "done", "cancelled"];
    const status = normalizeCity(req.body.status);
    if (!allowed.includes(status)) {
      return sendError(res, 400, "Некоректний статус");
    }

    res.json(db.updateApplicationStatus(id, status));
  } catch (err) {
    console.error("PATCH /api/admin/applications:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.delete("/api/admin/applications/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!db.deleteApplication(id)) {
      return sendError(res, 404, "Заявку не знайдено");
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/applications:", err);
    sendError(res, 500, "Помилка сервера");
  }
});

app.use(express.static(__dirname));

app.get("/crm", (req, res) => {
  res.sendFile(path.join(__dirname, "crm", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  sendError(res, 500, "Помилка сервера");
});

app.listen(PORT, () => {
  console.log(`VIA сервер: http://localhost:${PORT}`);
  console.log(`CRM панель:  http://localhost:${PORT}/crm`);
  console.log(`Логін CRM:     admin / admin123`);
});
