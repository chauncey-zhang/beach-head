/* 素材加载管理：纯静态，使用 Image 对象加载本地 SVG（file:// 下可直接运行） */
window.BH = window.BH || {};

BH.loadAssets = function (map, onDone) {
  var keys = Object.keys(map);
  var total = keys.length;
  var done = 0;
  BH.images = {};
  if (total === 0) {
    onDone();
    return;
  }
  keys.forEach(function (key) {
    var img = new Image();
    img.onload = img.onerror = function () {
      done++;
      BH.images[key] = img;
      if (done === total) onDone();
    };
    img.src = map[key];
  });
};
