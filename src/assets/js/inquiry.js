(function () {
  window.openInquiry = function () {
    if (typeof resetZoom === 'function') resetZoom();
    document.getElementById('inquiry-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeInquiry = function () {
    document.getElementById('inquiry-overlay').classList.remove('active');
    document.body.style.overflow = '';
  };

  function init() {
    var overlay = document.getElementById('inquiry-overlay');
    var form = document.getElementById('inquiry-form');

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeInquiry();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        closeInquiry();
      }
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        }).then(function (response) {
          if (response.ok) {
            form.style.display = 'none';
            document.getElementById('inquiry-success').style.display = 'block';
          }
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
