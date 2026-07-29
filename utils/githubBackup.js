'use strict';

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
}

export async function testConnection(token, owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Authorization: `token ${token}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Error de conexión');
  }
  return true;
}

export async function uploadFile(token, owner, repo, path, content, message) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  let sha;
  const check = await fetch(url, {
    headers: { Authorization: `token ${token}` }
  });
  if (check.ok) {
    const existing = await check.json();
    sha = existing.sha;
  }

  const body = {
    message,
    content: toBase64(content),
    sha
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Error al subir archivo');
  }

  return res.json();
}

export async function downloadFile(owner, repo) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/backups/latest.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('No hay backup disponible en GitHub');
  }
  return res.json();
}

const GITHUB_DEFAULTS = {
  TOKEN: '',
  OWNER: '',
  REPO: 'syntra-pos'
};

function hasAnyGitHubConfig() {
  return (
    sessionStorage.getItem('github_token') !== null ||
    localStorage.getItem('github_owner') !== null ||
    localStorage.getItem('github_repo') !== null
  );
}

export function applyGitHubDefaults() {
  if (!hasAnyGitHubConfig()) {
    saveGitHubConfig({
      token: GITHUB_DEFAULTS.TOKEN,
      owner: GITHUB_DEFAULTS.OWNER,
      repo: GITHUB_DEFAULTS.REPO,
      autoSync: true
    });
  }
}

export const GITHUB_CONFIG_KEY = {
  TOKEN: 'github_token',
  OWNER: 'github_owner',
  REPO: 'github_repo',
  AUTO_SYNC: 'github_auto_sync'
};

export function loadGitHubConfig() {
  return {
    token: sessionStorage.getItem(GITHUB_CONFIG_KEY.TOKEN) || '',
    owner: localStorage.getItem(GITHUB_CONFIG_KEY.OWNER) || '',
    repo: localStorage.getItem(GITHUB_CONFIG_KEY.REPO) || '',
    autoSync: localStorage.getItem(GITHUB_CONFIG_KEY.AUTO_SYNC) === 'true'
  };
}

export function saveGitHubConfig(config) {
  sessionStorage.setItem(GITHUB_CONFIG_KEY.TOKEN, config.token);
  localStorage.setItem(GITHUB_CONFIG_KEY.OWNER, config.owner);
  localStorage.setItem(GITHUB_CONFIG_KEY.REPO, config.repo);
  localStorage.setItem(GITHUB_CONFIG_KEY.AUTO_SYNC, config.autoSync ? 'true' : 'false');
}
