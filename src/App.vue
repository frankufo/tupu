<template>
  <div id="app">
    <Login v-if="!isLoggedIn" @login-success="onLoginSuccess" />
    <GraphViewer v-else />
  </div>
</template>
<script>
import GraphViewer from './components/GraphViewer.vue';
import NodeEditor from './components/NodeEditor.vue';
import RelationEditor from './components/RelationEditor.vue';
import Login from './components/Login.vue';
export default {
  name: 'App',
  components: { GraphViewer, NodeEditor, RelationEditor, Login },
  data() {
    return {
      isLoggedIn: localStorage.getItem('isLoggedIn') === 'true'
    };
  },
  methods: {
    onLoginSuccess() {
      this.isLoggedIn = true;
    },
    handleLogout() {
      localStorage.removeItem('isLoggedIn');
      this.isLoggedIn = false;
    }
  }
};
</script>
<style>
#app {
  width: 100%;
  height: 100vh;
}
</style>