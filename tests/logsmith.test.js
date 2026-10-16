// Unit tests for the pure parts of content.js (run with `npm test`). The page behaviour is covered by tests/e2e/run.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const { siteOf, authText, retryText, LOGIN_PATH } = require("../content.js");

test("sites are recognised by host", () => {
  assert.equal(siteOf("www.instagram.com"), "instagram");
  assert.equal(siteOf("x.com"), "x");
  assert.equal(siteOf("mobile.twitter.com"), "x");
  assert.equal(siteOf("www.tiktok.com"), "tiktok");
  assert.equal(siteOf("www.threads.net"), "threads");
  assert.equal(siteOf("old.reddit.com"), "reddit");
  assert.equal(siteOf("example.com"), null);
  assert.equal(siteOf("notinstagram.com"), null);
  assert.equal(siteOf("instagram.com.evil.org"), null);
});

test("texts that ask for an account are found in many languages", () => {
  for (const t of [
    "Log in to continue", "Sign up to see more", "Create an account", "Don't miss what's happening. Log in",
    "Melde dich an, um fortzufahren: Anmelden", "Jetzt registrieren", "Konto erstellen", "Se connecter", "Créer un compte",
    "Iniciar sesión", "Crear cuenta", "Accedi per continuare", "Registrati", "Entrar", "Cadastre-se", "Войти", "Зарегистрироваться",
    "ログインして続ける", "로그인", "登录", "Giriş yap"
  ]) assert.ok(authText(t), t);
});

test("ordinary texts are not mistaken for a wall", () => {
  for (const t of [
    "Share this post", "Copy link", "Comments (12)", "Settings and privacy", "Catalogue of entries",
    "Translate this page", "Report", "Registered users only see this badge"
  ]) assert.equal(authText(t), false, t);
});

test("real login pages are left alone", () => {
  for (const p of ["/accounts/login/", "/login", "/i/flow/login", "/i/flow/signup", "/signup", "/register", "/checkpoint/"]) {
    assert.ok(LOGIN_PATH.test(p), p);
  }
  for (const p of ["/", "/nasa/", "/@user/video/123", "/explore", "/loginfoo", "/home"]) assert.equal(LOGIN_PATH.test(p), false, p);
});

test("retry buttons are recognised, log-in buttons are not", () => {
  for (const ok of ["Try again", "Retry", "Load more", "Erneut versuchen", "Mehr laden", "Réessayer", "もう一度"]) assert.ok(retryText(ok), ok);
  for (const no of ["Log in", "Sign up", "Retryable", "Follow"]) assert.ok(!retryText(no), no);
});
