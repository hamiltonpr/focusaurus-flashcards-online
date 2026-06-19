const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

// Required for @supabase/supabase-js package exports in Metro
config.resolver.unstable_enablePackageExports = true

module.exports = config
