<template>
  <div style="margin: 10px 0;">
    <input type="file" accept=".xls,.xlsx" @change="handleFile" />
    <button @click="importExcel" :disabled="!rows.length">
      导入业务关系
    </button>
  </div>
</template>

<script>
import * as XLSX from 'xlsx';
import { runCypher } from '../utils/neo4jService';

export default {
  data() {
    return {
      rows: []
    };
  },
  methods: {
    handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        this.rows = XLSX.utils.sheet_to_json(sheet);
      };
      reader.readAsBinaryString(file);
    },

    async importExcel() {
      for (const row of this.rows) {
        const 发起系统 = row['发起系统'];
        const 发起方交易名称 = row['发起方交易名称'];
        const 本系统名称 = row['本系统名称'];
        const 本系统交易名称 = row['本系统交易名称'];
        const 本系统交易接口编号 = row['本系统交易接口编号'];

        // 下游字段
        const 下游系统1 = row['下游系统1'];
        const 下游系统1交易名称 = row['下游系统1交易名称'];
        const 下游系统1交易接口编号 = row['下游系统1交易接口编号'];

        // ① 原有必填校验
        if (!发起系统 || !发起方交易名称 || !本系统名称 || !本系统交易名称) {
          console.warn('跳过空行：', row);
          continue;
        }

        // ② 下游字段“要么全填、要么全不填”校验
        const hasAnyDownstream =
          !!下游系统1 || !!下游系统1交易名称 || !!下游系统1交易接口编号;

        if (hasAnyDownstream) {
          if (!下游系统1 || !下游系统1交易名称 || !下游系统1交易接口编号) {
            console.warn('下游字段不完整，跳过该行：', row);
            continue;
          }
        }

        // ③ 基础关系（原有）
        let cypher = `
          MERGE (s1:系统名称 {name: $发起系统})
          MERGE (t1:交易名称 {name: $发起方交易名称})
          MERGE (s2:系统名称 {name: $本系统名称})
          MERGE (t2:交易名称 {name: $本系统交易名称})
          ON CREATE SET
            t2.interfaceCode = $本系统交易接口编号
          ON MATCH SET
            t2.interfaceCode = coalesce(t2.interfaceCode, $本系统交易接口编号)

          MERGE (s1)-[:包含]->(t1)
          MERGE (s2)-[:包含]->(t2)
          MERGE (t1)-[:调用]->(t2)
        `;

        // ④ 有下游才追加下游关系
        if (hasAnyDownstream) {
          cypher += `
            MERGE (s3:系统名称 {name: $下游系统1})
            MERGE (t3:交易名称 {name: $下游系统1交易名称})
            ON CREATE SET
              t3.interfaceCode = $下游系统1交易接口编号
            ON MATCH SET
              t3.interfaceCode = coalesce(t3.interfaceCode, $下游系统1交易接口编号)

            MERGE (s3)-[:包含]->(t3)
            MERGE (t2)-[:调用]->(t3)
          `;
        }

        await runCypher(cypher, {
          发起系统,
          发起方交易名称,
          本系统名称,
          本系统交易名称,
          本系统交易接口编号,
          下游系统1,
          下游系统1交易名称,
          下游系统1交易接口编号
        });
      }

      alert('✅ Excel 导入完成');
      this.$emit('importFinished');
    }

  }
};
</script>
