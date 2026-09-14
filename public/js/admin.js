// Admin panel interactions — SEO auto-suggest + keyword research
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- Question form: toggle MCQ options when type changes ----
  var qtype = document.getElementById('qtype');
  var optionsWrap = document.getElementById('optionsWrap');
  if (qtype && optionsWrap) {
    qtype.addEventListener('change', function () {
      optionsWrap.classList.toggle('hidden', qtype.value !== 'mcq');
    });
  }

  // ---- SEO Auto-Suggest ----
  var suggestBtn = document.getElementById('seoSuggestBtn');
  if (suggestBtn) {
    suggestBtn.addEventListener('click', function () {
      var status = document.getElementById('seoStatus');
      var title = (document.getElementById('qTitle') || {}).value || '';
      var question = (document.getElementById('qText') || {}).value || '';
      var exam = (document.querySelector('input[name="exam"]') || {}).value || '';
      var typeSel = document.querySelector('select[name="qtype"]');
      var qtypeVal = typeSel ? typeSel.value : 'mcq';
      var catSel = document.querySelector('select[name="category_id"]');
      var category = catSel ? catSel.options[catSel.selectedIndex].text : '';

      if (!title && !question) {
        status.textContent = '⚠ Please fill in at least the question title or question text first.';
        status.style.color = '#b91c1c';
        return;
      }
      status.textContent = '⏳ Generating SEO suggestions…';
      status.style.color = '#334155';

      fetch('/api/seo/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, question: question, category: category, qtype: qtypeVal, exam: exam })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) throw new Error(d.error || 'Failed');
          document.getElementById('seoResults').classList.remove('hidden');
          document.getElementById('seoTitle').value = d.title;
          document.getElementById('metaDesc').value = d.metaDescription;
          document.getElementById('seoKeywords').value = d.keywords.join(', ');
          var chips = document.getElementById('titleChips');
          chips.innerHTML = '';
          d.titles.forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'title-chip';
            b.textContent = t;
            b.addEventListener('click', function () { document.getElementById('seoTitle').value = t; });
            chips.appendChild(b);
          });
          status.textContent = '✅ Done! Click any title chip to use that title, then edit if needed.';
          status.style.color = '#15803d';
        })
        .catch(function (e) {
          status.textContent = '⚠ ' + e.message;
          status.style.color = '#b91c1c';
        });
    });
  }

  // ---- Keyword research ----
  window.researchKeyword = function () {
    var input = document.getElementById('kwInput');
    var box = document.getElementById('researchResult');
    var kw = (input.value || '').trim();
    if (kw.length < 2) return;
    box.classList.remove('hidden');
    box.innerHTML = '<p class="dim">Researching “' + esc(kw) + '”…</p>';
    fetch('/api/seo/research?keyword=' + encodeURIComponent(kw))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { box.innerHTML = '<div class="alert danger">' + esc(d.error) + '</div>'; return; }
        var compClass = d.competition === 'High' ? 'high' : d.competition === 'Medium' ? 'medium' : 'low';
        var html = '<div class="panel">';
        html += '<div class="research-metrics">';
        html += '<div class="metric"><strong>' + d.volume.toLocaleString() + '</strong><span>Est. volume / month</span></div>';
        html += '<div class="metric"><strong>' + d.difficulty + '</strong><span>Difficulty (0-95)</span></div>';
        html += '<div class="metric"><strong>$' + d.cpc.toFixed(2) + '</strong><span>Est. CPC</span></div>';
        html += '<div class="metric"><strong><span class="badge comp-' + compClass + '">' + esc(d.competition) + '</span></strong><span>Competition</span></div>';
        html += '<div class="metric"><strong>' + d.monthlyPotential.toLocaleString() + '</strong><span>Monthly clicks potential</span></div>';
        html += '</div>';
        html += '<p class="dim"><strong>' + esc(d.keyword) + '</strong> ' + (d.longTail ? '(long-tail, easier to rank)' : '(head term)') + ' • ' + d.existingCount + ' similar question(s) already on this site</p>';
        html += '<h4>Related keyword suggestions (click to research)</h4><p>';
        d.suggestions.forEach(function (s) {
          html += '<span class="kw-suggestion" onclick="document.getElementById(\'kwInput\').value=this.textContent;researchKeyword()">' + esc(s) + '</span>';
        });
        html += '</p>';
        if (d.matches && d.matches.length) {
          html += '<h4>Your questions that already target this keyword</h4><ul class="match-list">';
          d.matches.forEach(function (m) {
            html += '<li><a href="/admin/questions/' + m.id + '/edit" target="_blank">' + esc(m.title) + '</a> <span class="dim">(' + esc(m.category_name) + ', ' + m.views + ' views)</span></li>';
          });
          html += '</ul>';
        }
        html += '<button class="btn-primary" onclick="trackKeyword(' + JSON.stringify(JSON.stringify(d)) + ')">📌 Track this keyword</button>';
        html += '</div>';
        box.innerHTML = html;
      })
      .catch(function () { box.innerHTML = '<div class="alert danger">Research failed. Please try again.</div>'; });
  };

  window.trackKeyword = function (json) {
    var d = JSON.parse(json);
    fetch('/api/seo/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: d.keyword, search_volume: d.volume, difficulty: d.difficulty, cpc: d.cpc, competition: d.competition })
    }).then(function () { location.reload(); });
  };

  window.deleteTracked = function (id) {
    if (!confirm('Remove this tracked keyword?')) return;
    fetch('/api/seo/tracked/' + id, { method: 'DELETE' }).then(function () { location.reload(); });
  };

  // ---- Rich text composer for answers ----
  function initRichEditor() {
    var editor = document.getElementById('answerEditor');
    if (!editor) return;
    var hidden = document.getElementById('answerTextHidden');
    var source = document.getElementById('answerSource');
    var bar = document.getElementById('answerToolbar');
    var sourceMode = false;

    function looksLikeHtml(s) { return /<\/?[a-z][^>]*>/i.test(s); }

    // Load existing content (from DB) into the composer.
    var initial = hidden.value || '';
    editor.innerHTML = looksLikeHtml(initial) ? initial : initial.replace(/\n/g, '<br>');
    source.value = initial;

    function syncFromEditor() { hidden.value = editor.innerHTML; source.value = editor.innerHTML; }
    function syncToEditor() { editor.innerHTML = source.value; hidden.value = editor.innerHTML; }

    if (bar) {
      bar.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-cmd]') : null;
        if (!btn) return;
        var cmd = btn.getAttribute('data-cmd');
        var val = btn.getAttribute('data-value') || null;

        if (cmd === 'source') {
          sourceMode = !sourceMode;
          if (sourceMode) { syncFromEditor(); editor.style.display = 'none'; source.style.display = 'block'; source.focus(); }
          else { syncToEditor(); source.style.display = 'none'; editor.style.display = ''; editor.focus(); }
          return;
        }
        if (cmd === 'table') {
          var tbl = '<table><thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead>' +
            '<tbody><tr><td>Cell</td><td>Cell</td><td>Cell</td></tr>' +
            '<tr><td>Cell</td><td>Cell</td><td>Cell</td></tr></tbody></table><p><br></p>';
          editor.focus();
          document.execCommand('insertHTML', false, tbl);
          syncFromEditor();
          return;
        }
        if (cmd === 'link') {
          var url = window.prompt('Link URL (https://…)', 'https://');
          if (!url) return;
          var selText = window.getSelection ? window.getSelection().toString() : '';
          editor.focus();
          if (selText) { document.execCommand('createLink', false, url); }
          else { document.execCommand('insertHTML', false, '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + url + '</a>'); }
          syncFromEditor();
          return;
        }
        if (cmd === 'code') {
          var code = window.getSelection ? window.getSelection().toString() : '';
          editor.focus();
          document.execCommand('insertHTML', false, '<pre><code>' + (code || 'code') + '</code></pre>');
          syncFromEditor();
          return;
        }
        editor.focus();
        if (cmd === 'h2' || cmd === 'h3') { document.execCommand('formatBlock', false, cmd); }
        else { document.execCommand(cmd, false, val); }
        syncFromEditor();
      });
    }

    editor.addEventListener('input', syncFromEditor);
    editor.addEventListener('keyup', syncFromEditor);

    var form = editor.closest('form');
    if (form) {
      form.addEventListener('submit', function (ev) {
        syncFromEditor();
        var v = hidden.value.trim();
        if (!v || v === '<br>' || v === '<div><br></div>' || v === '<p><br></p>') {
          ev.preventDefault();
          alert('Please write the answer / solution before saving.');
          editor.style.display = '';
          source.style.display = 'none';
          editor.focus();
        }
      });
    }
  }
  initRichEditor();
})();
