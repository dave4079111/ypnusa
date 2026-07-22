/* YPNUS MLO Toolkit — frontend logic */
/* global ypnusMLO */

'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ypnusSetLoading(btnId, state) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.toggle('is-loading', state);
    btn.disabled = state;
}

function ypnusShowError(containerId, message) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
}

function ypnusHideError(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.hidden = true;
}

// ── Content Generator ─────────────────────────────────────────────────────────

function ypnusGenerateContent() {
    const articleEl = document.getElementById('ypnus-article-input');
    const article = articleEl ? articleEl.value.trim() : '';

    if (!article) {
        ypnusShowError('ypnus-content-error', 'Please paste an article or newsletter before generating.');
        return;
    }

    ypnusHideError('ypnus-content-error');
    ypnusSetLoading('ypnus-generate-btn', true);

    const outputEl = document.getElementById('ypnus-content-output');
    if (outputEl) outputEl.hidden = true;

    const formData = new FormData();
    formData.append('action',  'ypnus_generate_content');
    formData.append('nonce',   ypnusMLO.nonce);
    formData.append('article', article);

    fetch(ypnusMLO.ajaxUrl, { method: 'POST', body: formData })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (!data.success) {
                ypnusShowError('ypnus-content-error', data.data.message || 'An error occurred. Please try again.');
                return;
            }
            const posts = data.data;
            ypnusSetText('ypnus-linkedin-content',  posts.linkedin  || '');
            ypnusSetText('ypnus-instagram-content', posts.instagram || '');
            ypnusSetText('ypnus-tiktok-content',    posts.tiktok    || '');

            if (outputEl) outputEl.hidden = false;
        })
        .catch(function () {
            ypnusShowError('ypnus-content-error', 'Connection error. Please check your internet connection and try again.');
        })
        .finally(function () {
            ypnusSetLoading('ypnus-generate-btn', false);
        });
}

function ypnusSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ── Copy to Clipboard ─────────────────────────────────────────────────────────

function ypnusCopy(sourceId, btn) {
    const el = document.getElementById(sourceId);
    if (!el) return;

    const text = el.textContent || '';

    navigator.clipboard.writeText(text).then(function () {
        btn.textContent = 'Copied!';
        btn.classList.add('is-copied');
        setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('is-copied');
        }, 2000);
    }).catch(function () {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'Copied!';
        btn.classList.add('is-copied');
        setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('is-copied');
        }, 2000);
    });
}

// ── Keyword Scout ─────────────────────────────────────────────────────────────

function ypnusKeywordScout() {
    const inputEl = document.getElementById('ypnus-keyword-input');
    const topic = inputEl ? inputEl.value.trim() : '';

    if (!topic) {
        ypnusShowError('ypnus-keyword-error', 'Please enter a topic to research.');
        return;
    }

    ypnusHideError('ypnus-keyword-error');
    ypnusSetLoading('ypnus-keyword-btn', true);

    const outputEl = document.getElementById('ypnus-keyword-output');
    if (outputEl) outputEl.hidden = true;

    const formData = new FormData();
    formData.append('action', 'ypnus_keyword_scout');
    formData.append('nonce',  ypnusMLO.nonce);
    formData.append('topic',  topic);

    fetch(ypnusMLO.ajaxUrl, { method: 'POST', body: formData })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (!data.success) {
                ypnusShowError('ypnus-keyword-error', data.data.message || 'An error occurred.');
                return;
            }
            ypnusRenderKeywords(data.data);
            if (outputEl) outputEl.hidden = false;
        })
        .catch(function () {
            ypnusShowError('ypnus-keyword-error', 'Connection error. Please try again.');
        })
        .finally(function () {
            ypnusSetLoading('ypnus-keyword-btn', false);
        });
}

function ypnusRenderKeywords(keywords) {
    const tbody = document.getElementById('ypnus-keyword-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    keywords.forEach(function (kw) {
        const intent     = (kw.intent || 'Informational').toLowerCase().replace(/\s+/g, '-');
        const difficulty = (kw.difficulty || 'Medium').toLowerCase();

        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + ypnusEsc(kw.keyword || '') + '</td>' +
            '<td><span class="ypnus-pill ypnus-pill--' + intent + '">' + ypnusEsc(kw.intent || '') + '</span></td>' +
            '<td><span class="ypnus-diff--' + difficulty + '">' + ypnusEsc(kw.difficulty || '') + '</span></td>' +
            '<td>' + ypnusEsc(kw.angle || '') + '</td>' +
            '<td><button class="ypnus-use-keyword-btn" onclick="ypnusUseKeyword(\'' + ypnusEscAttr(kw.keyword || '') + '\')">Use</button></td>';

        tbody.appendChild(tr);
    });
}

function ypnusUseKeyword(keyword) {
    // Scroll user to content generator if it exists on the same page
    const generatorEl = document.getElementById('ypnus-content-generator');
    const inputEl     = document.getElementById('ypnus-article-input');

    if (inputEl) {
        inputEl.value = 'Write a social media article for Mortgage Loan Officers about: ' + keyword;
    }

    if (generatorEl) {
        generatorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ── Sanitization helpers ──────────────────────────────────────────────────────

function ypnusEsc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function ypnusEscAttr(str) {
    return String(str).replace(/'/g, "\\'");
}

// ── Enter key on keyword input ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    const kInput = document.getElementById('ypnus-keyword-input');
    if (kInput) {
        kInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') ypnusKeywordScout();
        });
    }
});
