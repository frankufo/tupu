<template>
  <div style="margin: 10px 0;">
    <input type="file" accept=".xls,.xlsx" @change="handleFile" />
    <button @click="showPreview" :disabled="!rows.length">
      预览数据
    </button>
    
    <!-- 预览区域 -->
    <div v-if="previewHeaders.length" style="margin-top: 10px;">
      <!-- 冲突提示 -->
      <div v-if="hasConflict" style="color: red; margin-bottom: 10px; border: 1px solid red; padding: 10px; background-color: #fff5f5;">
        <strong>⚠️ 检测到冲突 {{ conflicts.length }} 条，以下冲突行将不导入：</strong>
        <ul style="margin: 5px 0 0 0;">
          <li v-for="(conflict, idx) in conflicts" :key="idx">
            {{ conflict.type }}：第 {{ conflict.rowNumbers.join('、') }} 行 - {{ conflict.details }}
          </li>
        </ul>
      </div>
      
      <!-- 必填字段缺失提示 -->
      <div v-if="requiredFieldErrors.length" style="color: orange; margin-bottom: 10px; border: 1px solid orange; padding: 10px; background-color: #fff8f0;">
        <strong>⚠️ 以下行存在必填字段缺失：</strong>
        <ul style="margin: 5px 0 0 0;">
          <li v-for="(err, idx) in requiredFieldErrors" :key="idx">
            第 {{ err.rowNumber }} 行：缺少 {{ err.missingFields.join('、') }}
          </li>
        </ul>
      </div>
      
      <!-- 预览表格 -->
      <div style="max-height: 300px; overflow: auto; margin-bottom: 10px;">
        <table border="1" style="border-collapse: collapse; width: 100%; font-size: 12px;">
          <thead>
            <tr>
              <th style="background-color: #f0f0f0;">行号</th>
              <th v-for="col in previewHeaders" :key="col" style="background-color: #f0f0f0;">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="idx"
                :style="{ 
                  backgroundColor: getRowBackground(idx),
                  color: getRowColor(idx)
                }">
              <td style="font-weight: bold;">{{ idx + 2 }}</td>
              <td v-for="col in previewHeaders" :key="col">{{ row[col] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <button @click="confirmImport" :disabled="hasConflict || importing">
        {{ importing ? '导入中...' : '确认导入（非冲突行）' }}
      </button>
      
      <span v-if="importResult" style="margin-left: 10px;">
        {{ importResult }}
      </span>
    </div>
  </div>
</template>
<script>
import * as XLSX from 'xlsx';
import { runCypher } from '../utils/neo4jService';
const excelHeaders = [
  '场景名称', '场景顺序', '发起系统名称', '发起交易名称', '发起交易交易码',
  '发起方规则名称', '规则内容A', '接口名称', '调用接口入参字段名称', '调用接口回参字段名称',
  '被调用接口所属系统名称', '被调用接口所属交易名称', '被调用接口交易交易码',
  '被调用方规则名称', '规则内容B', '被调用接口名称',
  '被调用接口的调用顺序', '接口调用条件', '被调用接口入参字段名称', '被调用接口回参字段名称'
];
const fieldKeys = [
  'sceneName', 'sceneOrder', 'initiatorSystemName', 'initiatorTransactionName',
  'initiatorTransactionCode', 'initiatorRuleName', 'initiatorRuleContent',
  'interfaceName', 'interfaceInputFieldName', 'interfaceOutputFieldName',
  'calleeSystemName', 'calleeTransactionName', 'calleeTransactionCode',
  'calleeRuleName', 'calleeRuleContent', 'calleeInterfaceName',
  'calleeOrder', 'callCondition', 'calleeInputFieldName', 'calleeOutputFieldName'
];
const requiredFields = [
  'sceneName', 'initiatorSystemName', 'initiatorTransactionName',
  'initiatorTransactionCode', 'interfaceName', 'calleeSystemName',
  'calleeTransactionName', 'calleeTransactionCode', 'calleeInterfaceName'
];
export default {
  data() {
    return {
      rows: [],
      previewHeaders: [],
      conflicts: [],
      conflictRowIndices: [],
      hasConflict: false,
      requiredFieldErrors: [],
      importing: false,
      importResult: ''
    };
  },
  methods: {
    splitFields(fieldValue) {
      if (!fieldValue || !fieldValue.toString().trim()) {
        return [];
      }
      return fieldValue.toString().split(/[,，]/).map(s => s.trim()).filter(s => s);
    },
    handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet);
        
        this.rows = this.parseRows(rawRows);
        this.previewHeaders = excelHeaders;
        this.conflicts = [];
        this.conflictRowIndices = [];
        this.hasConflict = false;
        this.requiredFieldErrors = [];
        this.importResult = '';
      };
      reader.readAsBinaryString(file);
    },
    parseRows(rawRows) {
      return rawRows.map(row => {
        const parsed = {};
        fieldKeys.forEach((key, index) => {
          parsed[key] = row[excelHeaders[index]] || '';
        });
        return parsed;
      });
    },
    getRowBackground(idx) {
      if (this.conflictRowIndices.includes(idx)) {
        return '#ffcccc';
      }
      return 'white';
    },
    getRowColor(idx) {
      if (this.conflictRowIndices.includes(idx)) {
        return '#cc0000';
      }
      return 'black';
    },
    detectConflicts() {
      const conflicts = [];
      const initiatorMap = new Map();
      const calleeMap = new Map();
      const conflictIndices = new Set();
      this.rows.forEach((row, index) => {
        const initiatorKey = `${row.initiatorTransactionCode}|${row.initiatorTransactionName}|${row.interfaceName}`;
        if (initiatorMap.has(initiatorKey)) {
          const existing = initiatorMap.get(initiatorKey);
          conflicts.push({
            type: '发起交易组冲突',
            rowNumbers: [existing, index + 2],
            details: `交易码【${row.initiatorTransactionCode}】交易名称【${row.initiatorTransactionName}】接口【${row.interfaceName}】`
          });
          conflictIndices.add(existing - 2);
          conflictIndices.add(index);
        } else {
          initiatorMap.set(initiatorKey, index + 2);
        }
        const calleeKey = `${row.calleeTransactionCode}|${row.calleeTransactionName}|${row.calleeInterfaceName}`;
        if (calleeMap.has(calleeKey)) {
          const existing = calleeMap.get(calleeKey);
          conflicts.push({
            type: '被调用接口组冲突',
            rowNumbers: [existing, index + 2],
            details: `交易码【${row.calleeTransactionCode}】交易名称【${row.calleeTransactionName}】接口【${row.calleeInterfaceName}】`
          });
          conflictIndices.add(existing - 2);
          conflictIndices.add(index);
        } else {
          calleeMap.set(calleeKey, index + 2);
        }
      });
      this.conflicts = conflicts;
      this.conflictRowIndices = Array.from(conflictIndices);
      this.hasConflict = conflicts.length > 0;
    },
    validateRequired() {
      const errors = [];
      
      this.rows.forEach((row, index) => {
        const missing = requiredFields.filter(field => !row[field] || row[field].toString().trim() === '');
        if (missing.length > 0) {
          errors.push({
            rowNumber: index + 2,
            missingFields: missing.map(f => this.getFieldLabel(f))
          });
        }
      });
      this.requiredFieldErrors = errors;
      return errors.length === 0;
    },
    getFieldLabel(field) {
      const index = fieldKeys.indexOf(field);
      return index >= 0 ? excelHeaders[index] : field;
    },
    showPreview() {
      if (!this.rows.length) return;
      
      this.detectConflicts();
      this.validateRequired();
    },
    getValidRows() {
      return this.rows.filter((row, index) => !this.conflictRowIndices.includes(index));
    },
    async confirmImport() {
      if (this.hasConflict || this.importing) return;
      this.importing = true;
      this.importResult = '';
      
      const validRows = this.getValidRows();
      let successCount = 0;
      let errorCount = 0;
      const errorMessages = [];
      for (const row of validRows) {
        try {
          const { cypher, params } = this.buildCypher(row);
          await runCypher(cypher, params);
          successCount++;
        } catch (error) {
          errorCount++;
          errorMessages.push(`第${validRows.indexOf(row) + 2}行: ${error.message}`);
          console.error('导入错误：', error);
        }
      }
      this.importing = false;
      
      if (errorCount > 0) {
        this.importResult = `✅ 成功导入 ${successCount} 行，❌ 失败 ${errorCount} 行`;
        console.error('导入错误详情：', errorMessages);
      } else {
        this.importResult = `✅ 成功导入 ${successCount} 行`;
      }
      alert(this.importResult);
      this.$emit('importFinished');
    },
    buildCypher(row) {
      const params = {
        sceneName: row.sceneName,
        sceneOrder: row.sceneOrder || null,
        initiatorSystemName: row.initiatorSystemName,
        initiatorTransactionName: row.initiatorTransactionName,
        initiatorTransactionCode: row.initiatorTransactionCode,
        initiatorRuleName: row.initiatorRuleName || null,
        initiatorRuleContent: row.initiatorRuleContent || null,
        interfaceName: row.interfaceName,
        calleeSystemName: row.calleeSystemName,
        calleeTransactionName: row.calleeTransactionName,
        calleeTransactionCode: row.calleeTransactionCode,
        calleeRuleName: row.calleeRuleName || null,
        calleeRuleContent: row.calleeRuleContent || null,
        calleeInterfaceName: row.calleeInterfaceName,
        calleeOrder: row.calleeOrder || null,
        callCondition: row.callCondition || null
      };
      let cypher = '';
      const hasInitiatorRule = row.initiatorRuleName && row.initiatorRuleName.toString().trim() !== '';
      const hasCalleeRule = row.calleeRuleName && row.calleeRuleName.toString().trim() !== '';
      const interfaceInputFields = this.splitFields(row.interfaceInputFieldName);
      const interfaceOutputFields = this.splitFields(row.interfaceOutputFieldName);
      const calleeInputFields = this.splitFields(row.calleeInputFieldName);
      const calleeOutputFields = this.splitFields(row.calleeOutputFieldName);
      cypher += `MERGE (scene:场景名称 {name: $sceneName})\n`;
      cypher += `MERGE (initiatorSys:系统名称 {name: $initiatorSystemName})\n`;
      cypher += `MERGE (initiatorTx:交易名称 {name: $initiatorTransactionName})\n`;
      cypher += `SET initiatorTx.interfaceCode = $initiatorTransactionCode\n`;
      cypher += `MERGE (iface:接口名称 {name: $interfaceName})\n`;
      if (hasInitiatorRule) {
        cypher += `MERGE (initiatorRule:规则 {name: $initiatorRuleName})\n`;
        cypher += `SET initiatorRule.transRule = $initiatorRuleContent\n`;
      }
      interfaceInputFields.forEach((fieldName, idx) => {
        cypher += `MERGE (ifaceInputField${idx}:接口入参字段名称 {name: '${fieldName}'})\n`;
        cypher += `MERGE (iface)-[:包含]->(ifaceInputField${idx})\n`;
      });
      interfaceOutputFields.forEach((fieldName, idx) => {
        cypher += `MERGE (ifaceOutputField${idx}:接口回参字段名称 {name: '${fieldName}'})\n`;
        cypher += `MERGE (iface)-[:包含]->(ifaceOutputField${idx})\n`;
      });
      cypher += `MERGE (scene)-[:包含 {senaorder: $sceneOrder}]->(initiatorTx)\n`;
      cypher += `MERGE (initiatorSys)-[:包含]->(initiatorTx)\n`;
      if (hasInitiatorRule) {
        cypher += `MERGE (initiatorTx)-[:包含]->(initiatorRule)\n`;
        cypher += `MERGE (initiatorRule)-[:包含]->(iface)\n`;
      } else {
        cypher += `MERGE (initiatorTx)-[:包含]->(iface)\n`;
      }
      cypher += `MERGE (calleeSys:系统名称 {name: $calleeSystemName})\n`;
      cypher += `MERGE (calleeTx:交易名称 {name: $calleeTransactionName})\n`;
      cypher += `SET calleeTx.interfaceCode = $calleeTransactionCode\n`;
      cypher += `MERGE (calleeIface:接口名称 {name: $calleeInterfaceName})\n`;
      cypher += `SET calleeIface.order = $calleeOrder\n`;
      cypher += `SET calleeIface.callCondition = $callCondition\n`;
      if (hasCalleeRule) {
        cypher += `MERGE (calleeRule:规则 {name: $calleeRuleName})\n`;
        cypher += `SET calleeRule.transRule = $calleeRuleContent\n`;
      }
      calleeInputFields.forEach((fieldName, idx) => {
        cypher += `MERGE (calleeInputField${idx}:接口入参字段名称 {name: '${fieldName}'})\n`;
        cypher += `MERGE (calleeIface)-[:包含]->(calleeInputField${idx})\n`;
      });
      calleeOutputFields.forEach((fieldName, idx) => {
        cypher += `MERGE (calleeOutputField${idx}:接口回参字段名称 {name: '${fieldName}'})\n`;
        cypher += `MERGE (calleeIface)-[:包含]->(calleeOutputField${idx})\n`;
      });
      cypher += `MERGE (calleeSys)-[:包含]->(calleeTx)\n`;
      if (hasCalleeRule) {
        cypher += `MERGE (calleeTx)-[:包含]->(calleeRule)\n`;
        cypher += `MERGE (calleeRule)-[:包含]->(calleeIface)\n`;
      } else {
        cypher += `MERGE (calleeTx)-[:包含]->(calleeIface)\n`;
      }
      cypher += `MERGE (initiatorTx)-[:调用 {order: $calleeOrder, callCondition: $callCondition}]->(calleeIface)\n`;
      return { cypher, params };
    }
  }
};
</script>