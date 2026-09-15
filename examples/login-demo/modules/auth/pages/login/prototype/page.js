(function () {
  var config = window.LOGIN_PROTOTYPE_CONFIG;
  var form = document.getElementById('login-form');
  var username = document.getElementById('username');
  var password = document.getElementById('password');
  var remember = document.getElementById('remember');
  var submitButton = document.getElementById('submit-button');
  var togglePassword = document.getElementById('toggle-password');
  var environmentToggle = document.getElementById('environment-toggle');
  var environmentDetails = document.getElementById('environment-details');
  var notice = document.getElementById('notice');
  var submitting = false;

  window.__LOGIN_PROTOTYPE_STATE__ = { submitCount: 0, networkRequests: 0 };

  function setNotice(message, tone) {
    notice.textContent = message;
    notice.dataset.tone = tone;
    notice.hidden = false;
  }

  function clearErrors() {
    document.getElementById('username-error').textContent = '';
    document.getElementById('password-error').textContent = '';
    username.removeAttribute('aria-invalid');
    password.removeAttribute('aria-invalid');
    notice.hidden = true;
  }

  function showFieldError(input, message) {
    document.getElementById(input.id + '-error').textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }

  function validate() {
    var valid = true;
    if (!username.value.trim()) {
      showFieldError(username, '请输入账号');
      valid = false;
    }
    if (!password.value) {
      showFieldError(password, '请输入密码');
      valid = false;
    }
    if (!valid) {
      setNotice('请检查表单中的必填项。', 'danger');
      (username.hasAttribute('aria-invalid') ? username : password).focus();
    }
    return valid;
  }

  function setSubmitting(active) {
    submitting = active;
    submitButton.disabled = active;
    username.disabled = active;
    password.disabled = active;
    remember.disabled = active;
    togglePassword.disabled = active;
    submitButton.classList.toggle('is-loading', active);
    submitButton.querySelector('.button-label').textContent = active ? '登录中' : '登录';
  }

  function persistUsername() {
    if (remember.checked) localStorage.setItem(config.storageKey, username.value.trim());
    else localStorage.removeItem(config.storageKey);
  }

  togglePassword.addEventListener('click', function () {
    var visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    togglePassword.textContent = visible ? '显示' : '隐藏';
    togglePassword.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
    togglePassword.title = visible ? '显示密码' : '隐藏密码';
    password.focus();
  });

  environmentToggle.addEventListener('click', function () {
    var expanded = environmentToggle.getAttribute('aria-expanded') === 'true';
    environmentToggle.setAttribute('aria-expanded', String(!expanded));
    environmentDetails.hidden = expanded;
  });

  document.getElementById('forgot-password').addEventListener('click', function () {
    clearErrors();
    setNotice('这是交互原型。正式系统将从此处进入密码找回流程。', 'info');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submitting) return;

    clearErrors();
    if (!validate()) return;

    setSubmitting(true);
    window.__LOGIN_PROTOTYPE_STATE__.submitCount += 1;
    persistUsername();

    window.setTimeout(function () {
      var success = username.value.trim() === config.username && password.value === config.password;
      setSubmitting(false);
      if (success) {
        password.value = '';
        setNotice('验证通过，正在进入' + config.workspaceName + '。', 'success');
        return;
      }
      password.value = '';
      setNotice('账号或密码错误，请重新输入。', 'danger');
      password.focus();
    }, config.delayMs);
  });

  var remembered = localStorage.getItem(config.storageKey);
  if (remembered) {
    username.value = remembered;
    remember.checked = true;
  }
  username.focus();
}());
