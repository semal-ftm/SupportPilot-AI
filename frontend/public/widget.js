/*
 * SupportPilot embeddable chat widget.
 *
 * <script src="https://your-supportpilot-host/widget.js" data-color="#0f9d58" data-position="right" defer></script>
 *
 * Adds a floating launcher button that opens the SupportPilot customer chat
 * in an isolated iframe, so the host page's styles and scripts never touch it.
 */
(function () {
  if (window.__supportPilotLoaded) return;
  window.__supportPilotLoaded = true;

  var script = document.currentScript;
  var origin = new URL(script.src).origin;
  var color = script.getAttribute("data-color") || "#0f9d58";
  var side = script.getAttribute("data-position") === "left" ? "left" : "right";

  var style = document.createElement("style");
  style.textContent =
    ".sp-launcher{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483646;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;" +
    "background:" + color + ";color:#fff;box-shadow:0 10px 30px -8px rgba(0,0,0,.45);display:grid;place-items:center;transition:transform .2s}" +
    ".sp-launcher:hover{transform:scale(1.06)}" +
    ".sp-frame{position:fixed;bottom:88px;" + side + ":20px;z-index:2147483647;width:390px;height:620px;max-width:calc(100vw - 32px);max-height:calc(100vh - 110px);" +
    "border:0;border-radius:20px;box-shadow:0 30px 80px -20px rgba(0,0,0,.45);opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .2s,transform .2s;background:transparent}" +
    ".sp-frame.sp-open{opacity:1;transform:none;pointer-events:auto}" +
    "@media (max-width:480px){.sp-frame{bottom:0;" + side + ":0;width:100vw;height:100vh;max-width:100vw;max-height:100vh;border-radius:0}}";
  document.head.appendChild(style);

  var chatIcon =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var closeIcon =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var button = document.createElement("button");
  button.className = "sp-launcher";
  button.setAttribute("aria-label", "Open support chat");
  button.innerHTML = chatIcon;

  var frame = null;
  var open = false;

  button.addEventListener("click", function () {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.className = "sp-frame";
      frame.title = "SupportPilot chat";
      frame.src = origin + "/widget?embed=1";
      document.body.appendChild(frame);
    }
    open = !open;
    // Let the iframe mount before animating in
    requestAnimationFrame(function () {
      frame.classList.toggle("sp-open", open);
    });
    button.innerHTML = open ? closeIcon : chatIcon;
    button.setAttribute("aria-label", open ? "Close support chat" : "Open support chat");
  });

  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    if (event.data === "supportpilot:close" && open) button.click();
    // The chat window reports the colour chosen in Settings → Chat window
    if (event.data && event.data.type === "supportpilot:branding" && /^#[0-9a-fA-F]{6}$/.test(event.data.color)) {
      button.style.background = event.data.color;
    }
  });

  document.body.appendChild(button);
})();
