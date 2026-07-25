(function () {
  "use strict";

  var pendingHref = "";
  var expectedAnswer = 0;
  var previousFocus = null;
  var root = null;
  var dialog = null;
  var answer = null;
  var question = null;
  var error = null;

  function buildGate() {
    root = document.createElement("div");
    root.className = "parental-gate";
    root.hidden = true;
    root.innerHTML =
      '<div class="parental-gate__dialog" role="dialog" aria-modal="true" aria-labelledby="parentalGateTitle" aria-describedby="parentalGateHelp">' +
        '<h2 id="parentalGateTitle">Grown-ups only</h2>' +
        '<p id="parentalGateHelp">Please ask a grown-up to solve this before leaving Mochi Paint.</p>' +
        '<p class="parental-gate__question" id="parentalGateQuestion"></p>' +
        '<label for="parentalGateAnswer">Answer</label>' +
        '<input class="parental-gate__answer" id="parentalGateAnswer" type="number" inputmode="numeric" autocomplete="off">' +
        '<p class="parental-gate__error" id="parentalGateError" role="status" aria-live="polite"></p>' +
        '<div class="parental-gate__actions">' +
          '<button class="parental-gate__cancel" type="button">Cancel</button>' +
          '<button class="parental-gate__continue" type="button">Continue</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    dialog = root.querySelector(".parental-gate__dialog");
    answer = root.querySelector(".parental-gate__answer");
    question = root.querySelector(".parental-gate__question");
    error = root.querySelector(".parental-gate__error");
    root.querySelector(".parental-gate__cancel").addEventListener("click", closeGate);
    root.querySelector(".parental-gate__continue").addEventListener("click", submitGate);
    root.addEventListener("click", function (event) {
      if (event.target === root) closeGate();
    });
    root.addEventListener("keydown", trapKeys);
  }

  function newChallenge() {
    var left = 6 + Math.floor(Math.random() * 10);
    var right = 6 + Math.floor(Math.random() * 10);
    expectedAnswer = left + right;
    question.textContent = "What is " + left + " + " + right + "?";
    answer.value = "";
    error.textContent = "";
  }

  function openGate(href) {
    if (!root) buildGate();
    pendingHref = href;
    previousFocus = document.activeElement;
    newChallenge();
    root.hidden = false;
    document.body.classList.add("parental-gate-open");
    answer.focus();
  }

  function closeGate() {
    if (!root || root.hidden) return;
    root.hidden = true;
    pendingHref = "";
    document.body.classList.remove("parental-gate-open");
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  function submitGate() {
    if (Number(answer.value) !== expectedAnswer) {
      error.textContent = "That answer does not match. Please ask a grown-up to try again.";
      answer.select();
      return;
    }
    var href = pendingHref;
    closeGate();
    if (href) window.location.href = href;
  }

  function trapKeys(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeGate();
      return;
    }
    if (event.key === "Enter" && event.target === answer) {
      event.preventDefault();
      submitGate();
      return;
    }
    if (event.key !== "Tab") return;
    var focusable = dialog.querySelectorAll("input,button");
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function shouldGate(link) {
    if (link.hasAttribute("data-parental-gate")) return true;
    var raw = link.getAttribute("href") || "";
    if (/^(mailto:|tel:)/i.test(raw)) return true;
    try {
      var destination = new URL(link.href, window.location.href);
      return /^https?:$/.test(destination.protocol) && destination.origin !== window.location.origin;
    } catch (error) {
      return false;
    }
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || !shouldGate(link)) return;
    event.preventDefault();
    openGate(link.href);
  });
})();
