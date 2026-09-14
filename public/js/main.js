// Public site interactions
(function () {
  // Mobile menu toggle
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Copy answer text
  var copyBtn = document.getElementById('copyAnswerBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var target = document.querySelector(copyBtn.getAttribute('data-copy-target'));
      var text = target ? target.innerText : '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          copyBtn.textContent = '✅ Copied!';
          setTimeout(function () { copyBtn.textContent = '📋 Copy Answer'; }, 1600);
        });
      } else {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copyBtn.textContent = '✅ Copied!';
        setTimeout(function () { copyBtn.textContent = '📋 Copy Answer'; }, 1600);
      }
    });
  }

  // Print button
  var printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', function () { window.print(); });
  }
})();
