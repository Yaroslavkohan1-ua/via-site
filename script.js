// ---------------------------------------------------------
// City list for autocomplete (demo data)
// ---------------------------------------------------------
const CITIES = [
  "Львів", "Київ", "Одеса", "Тернопіль", "Івано-Франківськ", "Луцьк",
  "Рівне", "Чернівці", "Ужгород", "Хмельницький", "Харків", "Полтава",
  "Варшава", "Краків", "Гданськ", "Вроцлав",
  "Берлін", "Мюнхен", "Гамбург", "Кельн", "Франкфурт", "Халле",
  "Фрайбург", "Лейпциг", "Гіссен", "Оффенбург", "Леррах",
  "Париж", "Ліон", "Марсель",
  "Рим", "Мілан", "Венеція",
  "Прага", "Брно",
  "Відень", "Зальцбург",
  "Мадрид", "Барселона"
];

// ---------------------------------------------------------
// Hero route: cycle through city pairs, bus "drives" between them
// ---------------------------------------------------------
const HERO_ROUTES = [
  { from: "LVIV", to: "PARIS" },
  { from: "KYIV", to: "WARSAW" },
  { from: "LUTSK", to: "WROCLAW" },
];

const heroCityFrom = document.getElementById("heroCityFrom");
const heroCityTo = document.getElementById("heroCityTo");
const heroBus = document.getElementById("heroBus");

if (heroCityFrom && heroCityTo && heroBus) {
  let routeIndex = 0;

  function runHeroCycle() {
    // 1) bus departs from the left, sitting at the start for a beat
    heroBus.style.left = "8px";
    heroBus.classList.remove("is-hidden");

    // 2) after a short pause, drive across to the destination
    setTimeout(() => {
      heroBus.style.left = "calc(100% - 8px)";
    }, 500);

    // 3) bus "arrives" — fade it out and swap the city names
    setTimeout(() => {
      heroBus.classList.add("is-hidden");
      heroCityFrom.classList.add("swap-out");
      heroCityTo.classList.add("swap-out");
    }, 500 + 1800);

    setTimeout(() => {
      routeIndex = (routeIndex + 1) % HERO_ROUTES.length;
      heroCityFrom.textContent = HERO_ROUTES[routeIndex].from;
      heroCityTo.textContent = HERO_ROUTES[routeIndex].to;

      heroCityFrom.classList.remove("swap-out");
      heroCityTo.classList.remove("swap-out");

      // reset the bus instantly (hidden) to the start for the next trip
      heroBus.style.transition = "none";
      heroBus.style.left = "8px";
      // force reflow so the next transition applies cleanly
      void heroBus.offsetWidth;
      heroBus.style.transition = "left 1.8s ease-in-out, opacity .35s ease";
    }, 500 + 1800 + 400);

    // 4) restart the whole cycle
    setTimeout(runHeroCycle, 500 + 1800 + 400 + 900);
  }

  runHeroCycle();
}

// ---------------------------------------------------------
// Set default date to today
// ---------------------------------------------------------
const dateInput = document.getElementById("dateInput");
if (dateInput && !dateInput.value) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  dateInput.min = `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------
// Routes from API + application modal
// ---------------------------------------------------------
let publishedRoutes = [];

const routeGrid = document.getElementById("routeGrid");
const appModal = document.getElementById("appModal");
const applicationForm = document.getElementById("applicationForm");
const modalClose = document.getElementById("modalClose");
const modalRoute = document.getElementById("modalRoute");
const appError = document.getElementById("appError");
const appSuccess = document.getElementById("appSuccess");

function renderRouteCard(route) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "route-card";
  btn.dataset.routeId = route.id;
  btn.dataset.from = route.from_city;
  btn.dataset.to = route.to_city;
  btn.innerHTML = `
    <div class="rc-route">
      <div class="rc-track" aria-hidden="true"><span class="rc-dot"></span><span class="rc-line-v"></span><span class="rc-dot"></span></div>
      <div class="rc-points">
        <div class="rc-point"><span class="rc-city">${route.from_city}</span><span class="rc-country">${route.from_country}</span></div>
        <div class="rc-point"><span class="rc-city">${route.to_city}</span><span class="rc-country">${route.to_country}</span></div>
      </div>
    </div>
    <div class="rc-action">
      <span class="rc-price">${Math.round(route.price)}&nbsp;€</span>
      <span class="rc-order">Замовити</span>
    </div>
  `;
  btn.addEventListener("click", () => openApplicationModal(route));
  return btn;
}

async function loadPublishedRoutes() {
  if (!routeGrid) return;
  try {
    const res = await fetch("/api/routes");
    publishedRoutes = await res.json();
    routeGrid.innerHTML = "";
    if (publishedRoutes.length === 0) {
      routeGrid.innerHTML = '<p class="route-empty">Наразі немає доступних маршрутів</p>';
      return;
    }
    publishedRoutes.forEach((route) => routeGrid.appendChild(renderRouteCard(route)));
  } catch {
    routeGrid.innerHTML = '<p class="route-empty">Не вдалося завантажити маршрути. Запустіть сервер.</p>';
  }
}

function findPublishedRoute(from, to) {
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();
  return publishedRoutes.find(
    (r) => r.from_city.toLowerCase() === f && r.to_city.toLowerCase() === t
  );
}

function openApplicationModal(route, extra = {}) {
  if (!appModal || !applicationForm) return;
  appError.hidden = true;
  appSuccess.hidden = true;
  applicationForm.reset();

  document.getElementById("appRouteId").value = route.id || "";
  document.getElementById("appFromCity").value = route.from_city;
  document.getElementById("appToCity").value = route.to_city;
  modalRoute.textContent = `${route.from_city} → ${route.to_city} · ${Math.round(route.price)} €`;

  if (extra.date) document.getElementById("appDate").value = extra.date;
  if (extra.pax) document.getElementById("appPax").value = extra.pax;

  if (dateInput && dateInput.min) {
    document.getElementById("appDate").min = dateInput.min;
  }

  appModal.hidden = false;
  document.getElementById("appName").focus();
}

function closeApplicationModal() {
  if (appModal) appModal.hidden = true;
}

if (modalClose) modalClose.addEventListener("click", closeApplicationModal);
if (appModal) {
  appModal.addEventListener("click", (e) => {
    if (e.target === appModal) closeApplicationModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !appModal.hidden) closeApplicationModal();
  });
}

if (applicationForm) {
  applicationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    appError.hidden = true;
    appSuccess.hidden = true;

    const payload = {
      route_id: document.getElementById("appRouteId").value || null,
      from_city: document.getElementById("appFromCity").value,
      to_city: document.getElementById("appToCity").value,
      client_name: document.getElementById("appName").value.trim(),
      client_phone: document.getElementById("appPhone").value.trim(),
      client_email: document.getElementById("appEmail").value.trim(),
      trip_date: document.getElementById("appDate").value,
      passengers: document.getElementById("appPax").value,
      comment: document.getElementById("appComment").value.trim(),
    };

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Помилка відправки");

      appSuccess.textContent = data.message;
      appSuccess.hidden = false;
      applicationForm.querySelector(".modal-submit").disabled = true;
      setTimeout(() => {
        closeApplicationModal();
        applicationForm.querySelector(".modal-submit").disabled = false;
      }, 2200);
    } catch (err) {
      appError.textContent = err.message;
      appError.hidden = false;
    }
  });
}

loadPublishedRoutes();

// ---------------------------------------------------------
// Swap "from" / "to"
// ---------------------------------------------------------
const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const swapBtn = document.getElementById("swapBtn");

swapBtn.addEventListener("click", () => {
  const tmp = fromInput.value;
  fromInput.value = toInput.value;
  toInput.value = tmp;
});

// ---------------------------------------------------------
// Simple autocomplete
// ---------------------------------------------------------
function setupAutocomplete(input, listEl) {
  let activeIndex = -1;

  function render(matches) {
    listEl.innerHTML = "";
    activeIndex = -1;
    if (matches.length === 0) {
      listEl.hidden = true;
      return;
    }
    matches.forEach((city) => {
      const li = document.createElement("li");
      li.textContent = city;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = city;
        listEl.hidden = true;
      });
      listEl.appendChild(li);
    });
    listEl.hidden = false;
  }

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      listEl.hidden = true;
      return;
    }
    const matches = CITIES.filter((c) => c.toLowerCase().startsWith(q)).slice(0, 6);
    render(matches);
  });

  input.addEventListener("keydown", (e) => {
    const items = Array.from(listEl.querySelectorAll("li"));
    if (listEl.hidden || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      input.value = items[activeIndex].textContent;
      listEl.hidden = true;
      return;
    } else if (e.key === "Escape") {
      listEl.hidden = true;
      return;
    } else {
      return;
    }

    items.forEach((li, i) => li.classList.toggle("active", i === activeIndex));
  });

  input.addEventListener("blur", () => {
    setTimeout(() => { listEl.hidden = true; }, 100);
  });
}

setupAutocomplete(fromInput, document.getElementById("fromSuggest"));
setupAutocomplete(toInput, document.getElementById("toSuggest"));

// ---------------------------------------------------------
// Gallery slider (swipe / arrows / dots)
// ---------------------------------------------------------
const sliderTrack = document.getElementById("sliderTrack");
const sliderPrev = document.getElementById("sliderPrev");
const sliderNext = document.getElementById("sliderNext");
const sliderDots = document.getElementById("sliderDots");

if (sliderTrack) {
  const slides = Array.from(sliderTrack.querySelectorAll(".slide"));

  // build dots
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Перейти до фото ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i));
    sliderDots.appendChild(dot);
  });
  const dots = Array.from(sliderDots.children);

  function currentIndex() {
    const slideWidth = sliderTrack.clientWidth;
    return Math.round(sliderTrack.scrollLeft / slideWidth);
  }

  function updateDots() {
    const idx = currentIndex();
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
  }

  function goToSlide(i) {
    const clamped = Math.max(0, Math.min(i, slides.length - 1));
    sliderTrack.scrollTo({
      left: clamped * sliderTrack.clientWidth,
      behavior: "smooth"
    });
  }

  sliderPrev.addEventListener("click", () => goToSlide(currentIndex() - 1));
  sliderNext.addEventListener("click", () => goToSlide(currentIndex() + 1));

  let scrollTimeout;
  sliderTrack.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(updateDots, 80);
  });

  // keyboard support when slider is focused
  sliderTrack.setAttribute("tabindex", "0");
  sliderTrack.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goToSlide(currentIndex() + 1);
    if (e.key === "ArrowLeft") goToSlide(currentIndex() - 1);
  });

  window.addEventListener("resize", updateDots);
  updateDots();
}

// ---------------------------------------------------------
// Mobile nav toggle
// ---------------------------------------------------------
const burgerBtn = document.getElementById("burgerBtn");
const mainNav = document.getElementById("mainNav");

burgerBtn.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  burgerBtn.setAttribute("aria-expanded", String(isOpen));
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    burgerBtn.setAttribute("aria-expanded", "false");
  });
});

// ---------------------------------------------------------
// Geography cards -> fill search form
// ---------------------------------------------------------
document.querySelectorAll(".geo-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    e.preventDefault();
    fromInput.value = card.dataset.from;
    toInput.value = card.dataset.to;
    document.querySelector(".ticket-card").scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

// ---------------------------------------------------------
// Search form submit -> open application if route exists
// ---------------------------------------------------------
const searchForm = document.getElementById("searchForm");
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = fromInput.value.trim();
  const to = toInput.value.trim();
  const date = dateInput.value;
  const pax = document.getElementById("paxInput").value;

  if (!from || !to) {
    alert("Вкажіть місто відправлення та призначення");
    return;
  }

  const route = findPublishedRoute(from, to);
  if (!route) {
    alert("Цей маршрут зараз недоступний. Оберіть напрямок зі списку «Популярні напрямки».");
    return;
  }

  openApplicationModal(route, { date, pax });
});
