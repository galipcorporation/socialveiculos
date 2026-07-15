module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // O plugin de worklets do Reanimated 4 PRECISA ser o último da lista.
    // Sem ele, animações/gestos caem no fallback da JS thread e o app trava.
    plugins: ['react-native-worklets/plugin'],
  }
}
