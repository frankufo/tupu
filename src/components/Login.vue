<template>
  <div class="login-container">
    <div class="login-box">
      <h2>知识图谱管理系统</h2>
      <input 
        type="password" 
        v-model="password" 
        placeholder="请输入密码"
        @keyup.enter="handleLogin"
      />
      <button @click="handleLogin">登录</button>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>
  </div>
</template>
<script>
export default {
  name: 'Login',
  data() {
    return {
      password: '',
      correctPassword: 'fzl',
      errorMsg: ''
    };
  },
  methods: {
    handleLogin() {
      if (this.password === this.correctPassword) {
        localStorage.setItem('isLoggedIn', 'true');
        this.$emit('login-success');
      } else {
        this.errorMsg = '密码错误，请重试';
      }
    }
  }
};
</script>
<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-box {
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  text-align: center;
  width: 300px;
}
.login-box h2 {
  margin-bottom: 20px;
  color: #333;
}
.login-box input {
  display: block;
  width: 100%;
  padding: 12px;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
  font-size: 14px;
}
.login-box button {
  width: 100%;
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}
.login-box button:hover {
  background: #5568d3;
}
.error {
  color: red;
  margin-top: 15px;
  font-size: 14px;
}
</style>