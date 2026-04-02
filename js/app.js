// CapeConnect compatibility bootstrap for the current static frontend.
(function () {
  function wireBackButtons() {
    document.querySelectorAll(".back-btn").forEach((button) => {
      button.addEventListener("click", () => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        window.location.href = "login.html";
      });
    });
  }

  function init() {
    const body = document.body;
    if (!body) return;

    if (!body.dataset.appReady) {
      body.dataset.appReady = "true";
    }

    wireBackButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
