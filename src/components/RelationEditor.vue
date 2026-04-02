<template>
  <form @submit.prevent="createRelationship">

    <select v-model="type" required>
      <option disabled value="">请选择关系类型</option>
      <option>包含</option>
      <option>调用</option>
      <option>触发</option>
    </select>

    <input 
      v-model="fromId" 
      placeholder="起点的节点名称" 
      required
    />

    <input 
      v-model="toId" 
      placeholder="终点的节点名称" 
      required
    />

    <!-- 只有调用关系才显示 -->
    <input
      v-if="type === '调用'"
      v-model.number="order"
      placeholder="调用顺序（如 0）"
    />
    <input
      v-if="type === '调用'"
      v-model.data="respField"
      placeholder="接口返回字段"
    />
    <input
      v-if="type === '调用'"
      v-model.data="callCondition"
      placeholder="接口调用条件"
    />
    <input
      v-if="type === '触发'"
      v-model.data="triggerCondition"
      placeholder="输入触发条件"
    />
    <input
      v-if="type === '包含'"
      v-model.data="senaorder"
      type="number"
      placeholder="输入场景交易顺序"
    />



    <button type="submit">新增关系</button>

  </form>
</template>

<script>
import { runCypher } from '../utils/neo4jService';

export default {
  data() {
    return {
      fromId: '',
      toId: '',
      type: '',
      order: null,
      respField: '',
      triggerCondition:'',
      callCondition:'',
      senaorder:null,
    };
  },

  methods: {

    async createRelationship() {

      if (!this.fromId || !this.toId || !this.type) {
        alert('起点、终点、关系类型为必填项');
        return;
      }

      // 如果是调用关系，order 必填
//      if (this.type === '调用' && (this.order === null || this.order === '')) {
//        alert('调用关系必须填写调用顺序');
//        return;
//      }

      try {

        let query = `
          MATCH (a {name: $fromName})
          MATCH (b {name: $toName})
          MERGE (a)-[r:${this.type}]->(b)
        `;

        const params = {
          fromName: this.fromId,
          toName: this.toId
        };

        // 仅调用关系设置 order和respField
        if (this.type === '调用') {
          query += `
            ON CREATE SET r.order = $order
            ON MATCH  SET r.order = $order
            ON CREATE SET r.respField = $respField
            ON MATCH  SET r.respField = $respField
            ON CREATE SET r.callCondition = $callCondition
            ON MATCH  SET r.callCondition = $callCondition
          `;
          params.order = this.order;
          params.respField = this.respField
          params.callCondition = this.callCondition
        };
        if (this.type === '触发') {
          query += `
            ON CREATE SET r.triggerCondition = $triggerCondition
            ON MATCH  SET r.triggerCondition = $triggerCondition
          `;
          params.triggerCondition = this.triggerCondition;
        };
        if (this.type === '包含') {
          query += `
            ON CREATE SET r.senaorder = $senaorder
            ON MATCH  SET r.senaorder = $senaorder
          `;
          params.senaorder = this.senaorder;
        }

        query += ` RETURN r`;

        await runCypher(query, params);

        alert('关系创建 / 更新成功');
        this.senaorder = null;

        this.$emit('nodeCreated');


      } catch (error) {
        console.error(error);
        alert('创建失败: ' + error.message);
      }
    }

  }
}
</script>