<template>
  <form @submit.prevent="createNode">
      <select v-model="label" required>
        <option disabled value="">请选择节点类型</option>
        <option>系统名称</option>
        <option>场景名称</option>
        <option>接口名称</option>
        <option>交易名称</option>
        <option>规则</option>
        <option>接口入参字段名称</option>
        <option>接口回参字段名称</option>
      </select>
      <input v-model="name" placeholder="请输入节点名称" required />
      <input v-model="url1" placeholder="请输入完整的核心交易学习知识库地址" style="width: 300px;" />
      <input v-if="label === '交易名称'" v-model="url2" placeholder="请输入完整的交易接口知识库地址" style="width: 300px;" />
      <input v-if="label === '交易名称'" v-model="interfaceCode" placeholder="请输入交易编号（交易码）" style="width: 200px;" />
      <input v-if="label === '规则'" v-model="transRule" placeholder="请输入交易规则内容" style="width: 200px;" />
      <button type="submit">新增节点</button>
  </form>
</template>

<script>
import { runCypher } from '../utils/neo4jService';

export default {
  data() {
    return {
      label: '',
      name: '',
      url1: '',
      url2: '',
      interfaceCode:'',
      transRule:''
    };
  },
  methods: {
    async createNode() {
      // 校验必填项
      if (!this.label || !this.name) {
        alert('节点类型和节点名称为必填项，请填写完整。');
        return;
      }

      const properties = {
        name: this.name,
        url1: this.url1
      };

      // 仅当为交易名称时，才加上url2
      if (this.label === '交易名称' && this.url2) {
        properties.url2 = this.url2;
      };
      if (this.label === '交易名称' && this.interfaceCode) {
        properties.interfaceCode = this.interfaceCode;
      };
      if (this.label === '规则' && this.transRule) {
        properties.transRule = this.transRule;
      };

      // 构建 Cypher 语句
      const propsString = Object.entries(properties)
        .map(([key, value]) => `${key}: '${value}'`)
        .join(', ');

      await runCypher(`CREATE (n:${this.label} {${propsString}})`);

      alert('新增节点成功');
      this.$emit('nodeCreated'); 

    }
  }
};
</script>
