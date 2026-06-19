const { spawn } = require("child_process")

const os = require("os")

const path = require("path")



function getLocalIp() {

  const nets = os.networkInterfaces()

  const candidates = []



  for (const [name, addrs] of Object.entries(nets)) {

    const lower = name.toLowerCase()

    if (lower.includes("virtual") || lower.includes("vethernet") || lower.includes("vmware") || lower.includes("hyper-v")) {

      continue

    }

    for (const net of addrs || []) {

      if (net.family !== "IPv4" || net.internal) continue

      candidates.push({ address: net.address, name })

    }

  }



  const wifi = candidates.find((c) => /wi-?fi|wlan|wireless/i.test(c.name))

  if (wifi) return wifi.address



  const home = candidates.find((c) => c.address.startsWith("192.168.") || c.address.startsWith("10."))

  return home?.address ?? candidates[0]?.address ?? "localhost"

}



const ip = getLocalIp()

const proxyPort = process.env.NHK_PROXY_PORT || "3847"

const proxyUrl = `http://${ip}:${proxyPort}`



console.log("")

console.log("Focasaurus mobile — one terminal, no web server needed.")

console.log(`Your phone must be on the same Wi-Fi. Metro host: ${ip}`)

console.log(`NHK proxy: ${proxyUrl} (same Wi-Fi required for NHK Easy News)`)

console.log("Scan the QR code in Expo Go when it appears.")

console.log("")



const proxyScript = path.join(__dirname, "nhk-proxy.mjs")

const proxy = spawn("node", [proxyScript], {

  stdio: "inherit",

  shell: true,

  env: {

    ...process.env,

    NHK_PROXY_PORT: proxyPort,

  },

})



proxy.on("exit", (code) => {

  if (code && code !== 0) {

    console.warn(`NHK proxy exited with code ${code}`)

  }

})



const child = spawn("npx", ["expo", "start", "--go", "--lan"], {

  stdio: "inherit",

  shell: true,

  env: {

    ...process.env,

    REACT_NATIVE_PACKAGER_HOSTNAME: ip,

    EXPO_PUBLIC_NHK_PROXY_URL: proxyUrl,

  },

})



function shutdown() {

  proxy.kill()

  child.kill()

  process.exit(0)

}



process.on("SIGINT", shutdown)

process.on("SIGTERM", shutdown)



child.on("exit", (code) => {

  proxy.kill()

  process.exit(code ?? 0)

})

