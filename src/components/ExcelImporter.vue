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
    normalizeString(value) {
      if (value === null || value === undefined) {
        return '';
      }
      return String(value).trim();
    },
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
      const stringifyFields = new Set([
        'sceneName',
        'sceneOrder',
        'initiatorSystemName',
        'initiatorTransactionName',
        'initiatorTransactionCode',
        'initiatorRuleName',
        'initiatorRuleContent',
        'interfaceName',
        'interfaceInputFieldName',
        'interfaceOutputFieldName',
        'calleeSystemName',
        'calleeTransactionName',
        'calleeTransactionCode',
        'calleeRuleName',
        'calleeRuleContent',
        'calleeInterfaceName',
        'calleeOrder',
        'callCondition',
        'calleeInputFieldName',
        'calleeOutputFieldName'
      ]);

      return rawRows.map(row => {
        const parsed = {};
        fieldKeys.forEach((key, index) => {
          const rawValue = row[excelHeaders[index]];
          parsed[key] = stringifyFields.has(key)
            ? this.normalizeString(rawValue)
            : (rawValue || '');
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
    normalizeValue(value) {
      if (value === null || value === undefined) {
        return '';
      }
      return value.toString().trim();
    },
    buildConflictEntity(row, rowIndex, side) {
      if (side === 'initiator') {
        return {
          rowIndex,
          rowNumber: rowIndex + 2,
          side: '调用方',
          transactionName: this.normalizeValue(row.initiatorTransactionName),
          transactionCode: this.normalizeValue(row.initiatorTransactionCode),
          interfaceName: this.normalizeValue(row.interfaceName)
        };
      }
      return {
        rowIndex,
        rowNumber: rowIndex + 2,
        side: '被调用方',
        transactionName: this.normalizeValue(row.calleeTransactionName),
        transactionCode: this.normalizeValue(row.calleeTransactionCode),
        interfaceName: this.normalizeValue(row.calleeInterfaceName)
      };
    },
    describeConflict(left, right) {
      const sameParts = [];
      const diffParts = [];
      if (left.transactionName === right.transactionName) {
        sameParts.push(`交易名称相同【${left.transactionName}】`);
      } else {
        diffParts.push(`交易名称不一致【${left.transactionName}】/【${right.transactionName}】`);
      }
      if (left.transactionCode === right.transactionCode) {
        sameParts.push(`交易码相同【${left.transactionCode}】`);
      } else {
        diffParts.push(`交易码不一致【${left.transactionCode}】/【${right.transactionCode}】`);
      }
      if (left.interfaceName === right.interfaceName) {
        sameParts.push(`接口名称相同【${left.interfaceName}】`);
      } else {
        diffParts.push(`接口名称不一致【${left.interfaceName}】/【${right.interfaceName}】`);
      }
      return `第 ${left.rowNumber} 行(${left.side}) 与 第 ${right.rowNumber} 行(${right.side}) 冲突：${sameParts.concat(diffParts).join('，')}`;
    },
    detectConflicts() {
      const conflicts = [];
      const conflictRowIndices = new Set();
      const entities = [];
      this.rows.forEach((row, rowIndex) => {
        entities.push(this.buildConflictEntity(row, rowIndex, 'initiator'));
        entities.push(this.buildConflictEntity(row, rowIndex, 'callee'));
      });
      const seenPairs = new Set();
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const left = entities[i];
          const right = entities[j];
          const pairKey = [
            `${left.rowNumber}-${left.side}`,
            `${right.rowNumber}-${right.side}`
          ].join('|');
          if (seenPairs.has(pairKey)) {
            continue;
          }
          seenPairs.add(pairKey);
          const sameCount =
            (left.transactionName === right.transactionName ? 1 : 0) +
            (left.transactionCode === right.transactionCode ? 1 : 0) +
            (left.interfaceName === right.interfaceName ? 1 : 0);
          if (sameCount === 3 || sameCount === 0) {
            continue;
          }
          conflicts.push({
            type: '三要素冲突',
            rowNumbers: [left.rowNumber, right.rowNumber],
            details: this.describeConflict(left, right)
          });
          conflictRowIndices.add(left.rowIndex);
          conflictRowIndices.add(right.rowIndex);
        }
      }
      this.conflicts = conflicts;
      this.conflictRowIndices = Array.from(conflictRowIndices);
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
        sceneOrder: row.sceneOrder && row.sceneOrder.toString().trim() !== '' ? row.sceneOrder : null,
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
        calleeOrder: row.calleeOrder && row.calleeOrder.toString().trim() !== '' ? row.calleeOrder : null,
        callCondition: row.callCondition && row.callCondition.toString().trim() !== '' ? row.callCondition : null
      };
      let cypher = '';
      const hasInitiatorRule = row.initiatorRuleName && row.initiatorRuleName.toString().trim() !== '';
      const hasCalleeRule = row.calleeRuleName && row.calleeRuleName.toString().trim() !== '';
      const escapeCypherString = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const interfaceInputFields = this.splitFields(row.interfaceInputFieldName).map(escapeCypherString);
      const interfaceOutputFields = this.splitFields(row.interfaceOutputFieldName).map(escapeCypherString);
      const calleeInputFields = this.splitFields(row.calleeInputFieldName).map(escapeCypherString);
      const calleeOutputFields = this.splitFields(row.calleeOutputFieldName).map(escapeCypherString);
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
      cypher += `MERGE (scene)-[sceneToInitiator:包含]->(initiatorTx)\n`;
      if (params.sceneOrder !== null) {
        cypher += `SET sceneToInitiator.senaorder = $sceneOrder\n`;
      }
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
      cypher += `MERGE (initiatorTx)-[initiatorToCallee:调用]->(calleeIface)\n`;
      if (params.calleeOrder !== null) {
        cypher += `SET initiatorToCallee.order = $calleeOrder\n`;
      }
      if (params.callCondition !== null) {
        cypher += `SET initiatorToCallee.callCondition = $callCondition\n`;
      }
      return { cypher, params };
    }
  }
};
</script>
