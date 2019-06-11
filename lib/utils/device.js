"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deviceInfo = deviceInfo;
exports.shouldCallHandlerOnWindowResize = shouldCallHandlerOnWindowResize;
function deviceInfo() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function shouldCallHandlerOnWindowResize() {
  var prevDimensions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var _deviceInfo = deviceInfo(),
      width = _deviceInfo.width,
      height = _deviceInfo.height;

  return prevDimensions.width !== width || prevDimensions.height !== height;
}