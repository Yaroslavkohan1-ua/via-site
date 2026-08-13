const STATUS_LABELS = {
  new: "Нова",
  processing: "В обробці",
  done: "Виконано",
  cancelled: "Скасовано",
};

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");
const newAppsBadge = document.getElementById("newAppsBadge");

const tabs = document.querySelectorAll(".crm-tab");
const tabRoutes = document.getElementById("tabRoutes");
const tabApplications = document.getElementById("tabApplications");

const routeForm = document.getElementById("routeForm");
const routeFormTitle = document.getElementById("routeFormTitle");
const routeFormError = document.getElementById("routeFormError");
const addRouteBtn = document.getElementById("addRouteBtn");
const cancelRouteBtn = document.getElementById("cancelRouteBtn");
const routesTableBody = document.getElementById("routesTableBody");

const appsTableBody = document.getElementById("appsTableBody");
const statusFilter = document.getElementById("statusFilter");

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Помилка сервера");
  return data;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso + "Z");
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showLogin() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
}

function showApp(username) {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  userLabel.textContent = username;
}

async function checkAuth() {
  try {
    const me = await api("/api/auth/me");
    showApp(me.username);
    await Promise.all([loadRoutes(), loadApplications()]);
    return true;
  } catch {
    showLogin();
    return false;
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("loginUser").value,
        password: document.getElementById("loginPass").value,
      }),
    });
    showApp(data.username);
    await Promise.all([loadRoutes(), loadApplications()]);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  showLogin();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.tab;
    tabRoutes.hidden = name !== "routes";
    tabApplications.hidden = name !== "applications";
  });
});

function resetRouteForm() {
  document.getElementById("routeId").value = "";
  document.getElementById("routeFromCity").value = "";
  document.getElementById("routeFromCountry").value = "Україна";
  document.getElementById("routeToCity").value = "";
  document.getElementById("routeToCountry").value = "Німеччина";
  document.getElementById("routePrice").value = "";
  document.getElementById("routeActive").checked = true;
  routeFormError.hidden = true;
}

addRouteBtn.addEventListener("click", () => {
  resetRouteForm();
  routeFormTitle.textContent = "Новий маршрут";
  routeForm.hidden = false;
  document.getElementById("routeFromCity").focus();
});

cancelRouteBtn.addEventListener("click", () => {
  routeForm.hidden = true;
  resetRouteForm();
});

routeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  routeFormError.hidden = true;

  const id = document.getElementById("routeId").value;
  const payload = {
    from_city: document.getElementById("routeFromCity").value,
    from_country: document.getElementById("routeFromCountry").value,
    to_city: document.getElementById("routeToCity").value,
    to_country: document.getElementById("routeToCountry").value,
    price: parseFloat(document.getElementById("routePrice").value),
    active: document.getElementById("routeActive").checked,
  };

  try {
    if (id) {
      await api(`/api/admin/routes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/admin/routes", { method: "POST", body: JSON.stringify(payload) });
    }
    routeForm.hidden = true;
    resetRouteForm();
    await loadRoutes();
  } catch (err) {
    routeFormError.textContent = err.message;
    routeFormError.hidden = false;
  }
});

async function loadRoutes() {
  const routes = await api("/api/admin/routes");
  if (routes.length === 0) {
    routesTableBody.innerHTML =
      '<tr class="empty-row"><td colspan="4">Маршрутів ще немає — додайте перший</td></tr>';
    return;
  }

  routesTableBody.innerHTML = routes
    .map(
      (r) => `
    <tr>
      <td>
        <div class="route-cell-main">${r.from_city} → ${r.to_city}</div>
        <div class="route-cell-sub">${r.from_country} → ${r.to_country}</div>
      </td>
      <td><strong>${Math.round(r.price)}&nbsp;€</strong></td>
      <td>
        <span class="${r.active ? "status-active" : "status-hidden"}">
          ${r.active ? "На сайті" : "Приховано"}
        </span>
      </td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit="${r.id}">Редагувати</button>
          <button type="button" class="btn btn-danger btn-sm" data-delete="${r.id}">Видалити</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  routesTableBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = routes.find((r) => r.id === parseInt(btn.dataset.edit, 10));
      if (!route) return;
      document.getElementById("routeId").value = route.id;
      document.getElementById("routeFromCity").value = route.from_city;
      document.getElementById("routeFromCountry").value = route.from_country;
      document.getElementById("routeToCity").value = route.to_city;
      document.getElementById("routeToCountry").value = route.to_country;
      document.getElementById("routePrice").value = route.price;
      document.getElementById("routeActive").checked = !!route.active;
      routeFormTitle.textContent = "Редагувати маршрут";
      routeForm.hidden = false;
    });
  });

  routesTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Видалити цей маршрут?")) return;
      await api(`/api/admin/routes/${btn.dataset.delete}`, { method: "DELETE" });
      await loadRoutes();
    });
  });
}

async function loadApplications() {
  const status = statusFilter.value;
  const url = status ? `/api/admin/applications?status=${status}` : "/api/admin/applications";
  const [apps, allApps] = await Promise.all([
    api(url),
    status ? api("/api/admin/applications") : Promise.resolve(null),
  ]);

  const newCount = (allApps || apps).filter((a) => a.status === "new").length;
  if (newCount > 0) {
    newAppsBadge.textContent = newCount;
    newAppsBadge.hidden = false;
  } else {
    newAppsBadge.hidden = true;
  }

  if (apps.length === 0) {
    appsTableBody.innerHTML =
      '<tr class="empty-row"><td colspan="6">Заявок поки немає</td></tr>';
    return;
  }

  appsTableBody.innerHTML = apps
    .map(
      (a) => `
    <tr>
      <td>${formatDate(a.created_at)}</td>
      <td>
        <div class="route-cell-main">${a.from_city} → ${a.to_city}</div>
        ${a.route_price ? `<div class="route-cell-sub">${Math.round(a.route_price)} €</div>` : ""}
      </td>
      <td>
        <div class="route-cell-main">${a.client_name}</div>
        <div class="route-cell-sub">${a.client_phone}${a.client_email ? " · " + a.client_email : ""}</div>
        ${a.comment ? `<div class="route-cell-sub">${a.comment}</div>` : ""}
      </td>
      <td>
        ${a.trip_date || "—"}<br>
        <span class="route-cell-sub">${a.passengers} пас.</span>
      </td>
      <td>
        <select class="status-select" data-app-id="${a.id}">
          ${Object.entries(STATUS_LABELS)
            .map(
              ([val, label]) =>
                `<option value="${val}" ${a.status === val ? "selected" : ""}>${label}</option>`
            )
            .join("")}
        </select>
      </td>
      <td>
        <button type="button" class="btn btn-danger btn-sm" data-del-app="${a.id}">Видалити</button>
      </td>
    </tr>
  `
    )
    .join("");

  appsTableBody.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      await api(`/api/admin/applications/${sel.dataset.appId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: sel.value }),
      });
      await loadApplications();
    });
  });

  appsTableBody.querySelectorAll("[data-del-app]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Видалити заявку?")) return;
      await api(`/api/admin/applications/${btn.dataset.delApp}`, { method: "DELETE" });
      await loadApplications();
    });
  });
}

statusFilter.addEventListener("change", loadApplications);

checkAuth();
