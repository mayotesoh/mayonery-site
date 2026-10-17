// 鑑定攻略セッション LP：必要最小限のJS
// SPではFAQを最初から開かない（PCは1問目だけ開いた状態）
(function () {
  if (window.matchMedia('(max-width: 768px)').matches) {
    document.querySelectorAll('.lp-q[open]').forEach(function (el) {
      el.removeAttribute('open');
    });
  }
})();
