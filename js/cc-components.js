(function () {
  function resolve(target) {
    if (!target) return null;
    if (typeof target === "string") return document.getElementById(target);
    return target;
  }

  function getFocusableElements(root) {
    return Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
  }

  const modalTrapMap = new WeakMap();
  const modalLastFocusMap = new WeakMap();

  function trapFocus(root, onClose) {
    function handleKeydown(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        if (onClose) onClose();
        return;
      }
      if (ev.key !== "Tab") return;
      const focusable = getFocusableElements(root);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
    root.addEventListener("keydown", handleKeydown);
    return function release() {
      root.removeEventListener("keydown", handleKeydown);
    };
  }

  const modal = {
    open(target) {
      const el = resolve(target);
      if (!el) return;
      modalLastFocusMap.set(el, document.activeElement);
      el.classList.add("open");
      el.setAttribute("aria-hidden", "false");
      const dialog = el.querySelector('[role="dialog"]');
      if (dialog) dialog.focus();
      const release = trapFocus(el, function () {
        modal.close(el);
      });
      modalTrapMap.set(el, release);
      document.body.style.overflow = "hidden";
    },

    close(target, options) {
      const el = resolve(target);
      if (!el) return;
      el.classList.remove("open");
      el.setAttribute("aria-hidden", "true");
      const resetIframe = !options || options.resetIframe !== false;
      if (resetIframe) {
        const iframe = el.querySelector("iframe");
        if (iframe) iframe.src = "";
      }
      const release = modalTrapMap.get(el);
      if (release) {
        release();
        modalTrapMap.delete(el);
      }
      const lastFocus = modalLastFocusMap.get(el);
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      modalLastFocusMap.delete(el);
      document.body.style.overflow = "";
    }
  };

  const alert = {
    show(target, type, message) {
      const el = resolve(target);
      if (!el) return;
      el.classList.add("cc-alert");
      el.classList.remove("cc-alert-success", "cc-alert-warning", "cc-alert-error");
      if (type === "success") el.classList.add("cc-alert-success");
      if (type === "warning") el.classList.add("cc-alert-warning");
      if (type === "error") el.classList.add("cc-alert-error");
      el.textContent = message || "";
      el.style.display = message ? "" : "none";
    },
    clear(target) {
      const el = resolve(target);
      if (!el) return;
      el.textContent = "";
      el.style.display = "none";
      el.classList.remove("cc-alert", "cc-alert-success", "cc-alert-warning", "cc-alert-error");
    }
  };

  const ticketCard = {
    create(params) {
      const p = params || {};
      const card = document.createElement("div");
      card.className = "ticket-card";
      const extraRows = Array.isArray(p.extraRows) ? p.extraRows : [];
      const extraHtml = extraRows
        .map((row) => `<div class="ticket-row"><span>${row.label || "-"}</span><span>${row.value || "-"}</span></div>`)
        .join("");
      card.innerHTML = `
        <div class="ticket-head">
          <div class="ticket-title">${p.title || "-"}</div>
          <div class="ticket-badge">${p.badge || "Active"}</div>
        </div>
        <div class="ticket-body">
          <div class="ticket-row"><span>From:</span><span>${p.from || "-"}</span></div>
          <div class="ticket-row"><span>To:</span><span>${p.to || "-"}</span></div>
          <div class="ticket-row"><span>Date:</span><span>${p.date || "-"}</span></div>
          <div class="ticket-row"><span>Time:</span><span>${p.time || "-"}</span></div>
          <div class="ticket-row"><span>Passengers:</span><span>${p.passengers || "1"}</span></div>
          ${extraHtml}
        </div>
      `;
      if (p.withActions) {
        const actions = document.createElement("div");
        actions.className = "ticket-actions";
        const btn = document.createElement("button");
        btn.className = "ticket-details-btn";
        btn.type = "button";
        btn.textContent = p.actionLabel || "View Details";
        if (typeof p.onAction === "function") btn.addEventListener("click", p.onAction);
        actions.appendChild(btn);
        card.appendChild(actions);
      }
      return card;
    }
  };

  window.CCComponents = {
    modal: modal,
    alert: alert,
    ticketCard: ticketCard,
    trapFocus: trapFocus
  };
})();
