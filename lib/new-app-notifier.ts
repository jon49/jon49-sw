// https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
const isDev = ["localhost", "127.0.0.1"].includes(document.location.hostname)
let refreshing = false
// The event listener that is fired when the service worker updates
// Here we reload the page
navigator.serviceWorker.addEventListener('controllerchange', function () {
  if (refreshing) return
  refreshing = true
  window.location.reload()
})

/// Checks if there is a new version of the app available
/// @param fn - Callback function to be called when a new version is available
/// @returns void
/// @example
/// notifier((worker) => {
///   // Show notification to user about new version
///   if (/* user confirms update */) {
///     worker.postMessage("skipWaiting")
///   }
/// })
function notifier(fn: (worker: ServiceWorker) => void) {
  let newWorker: ServiceWorker | undefined | null

  if ('serviceWorker' in navigator) {
    // Register the service worker
    navigator.serviceWorker.register('/web/sw.js').then(reg => {
      if ((newWorker = reg.waiting)?.state === 'installed') {
        // @ts-ignore
        fn(newWorker)
        return
      }
      reg.addEventListener('updatefound', () => {
        // An updated service worker has appeared in reg.installing!
        newWorker = reg.installing

        newWorker?.addEventListener('statechange', () => {

            // There is a new service worker available, show the notification
            if (newWorker?.state === "installed" && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage("installed")
              // If we're in dev/server auto-activate the new worker
              if (isDev) {
                try {
                  newWorker.postMessage({ action: 'skipWaiting' })
                } catch (err) {
                  // Ignore if worker doesn't accept messages
                }
              }
              fn(newWorker)
            }

        })
      })
    })
  }
}

notifier(notifyUserAboutNewVersion)

function skipWaiting(id: string) {
  let el = document.getElementById(id)
  el?.addEventListener("click", (e: MouseEvent) => {
    e.preventDefault()
    // @ts-ignore
    window.app.sw.postMessage({ action: 'skipWaiting' })
  })
}

function notifyUserAboutNewVersion(worker: ServiceWorker) {
  let nav = document.getElementById("sw-message")
  nav?.insertAdjacentHTML("afterbegin", `<div class=inline><a id=skipWaiting href="#">Click here to update your app.</a></div>`)
  // @ts-ignore
  skipWaiting("skipWaiting")
  // @ts-ignore
  window.app = window.app || {}
  // @ts-ignore
  window.app.sw = worker
}