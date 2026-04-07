
<template>
  <div>
    <ExcelImporter @importFinished="renderGraph" />
    <label style="margin-right: 10px;">请选择知识图谱范围：</label>
    <select v-model="selectedSystem" @change="renderGraph" :disabled="graphMode === 'TRANSACTION_DETAIL'" style="margin-bottom: 5px;width: 150px">
      <option value="ALL">全部</option>
      <option v-for="name in systemNames" :key="name" :value="name">
        {{ name }}
      </option>
    </select>
    <button v-if="graphMode === 'TRANSACTION_DETAIL'"
            @click="backToOverview"
            style="margin-bottom: 6px;">
      返回总览
    </button>

    <div id="viz" style="height: 570px;background-color: black;"></div>
    <!-- 弹框 -->
    <div
        ref="dialog"
        v-if="showDialog"
        class="custom-dialog"
        style="position: absolute; top: 50px; left: 100px; 
               background-color: #fff; 
               padding: 20px; 
               border: 1px solid #ccc; 
               z-index: 1000; 
               width: 320px;            /* ✅ 固定宽度 */
               height: 200px;           /* ✅ 固定高度 */
               overflow-y: auto;        /* ✅ 内容超出则出现滚动条 */
               box-sizing: border-box;  /* ✅ 防止padding撑大整体 */"
      >
      <div
          @mousedown="startDrag"
          style="
            height: 20px;
            margin: -20px -20px 10px -20px;
            padding: 10px 20px;
            background: #f5f5f5;
            font-weight: bold;
            cursor: move;
            user-select: none;
          "
        >
        <strong>节点信息编辑</strong>
      </div>
      

      <!-- name -->
      <div style="margin-bottom: 6px;">
        <span>名称：</span>
        <span v-if="!editMode.name">{{ popupContent.name }}</span>
        <input v-else v-model="editValues.name" />
        <button @click="toggleEdit('name')" style="margin-left: 6px;">
          {{ editMode.name ? '取消' : '编辑' }}
        </button>
      </div>

      <!-- url1 -->
      <div style="margin-bottom: 6px;">
        <span>交易学习知识库地址：</span>
        <span v-if="!editMode.url1">
          <a v-if="popupContent.url1" :href="popupContent.url1" target="_blank">{{ popupContent.url1 }}</a>
          <span v-else>（无）</span>
        </span>
        <input v-else v-model="editValues.url1" placeholder="请输入 url1" />
        <button @click="toggleEdit('url1')" style="margin-left: 6px;">
          {{ editMode.url1 ? '取消' : '编辑' }}
        </button>
      </div>

      <!-- url2 -->
      <div v-if="currentNodeLabel === '交易名称'" style="margin-bottom: 6px;">
        <span>交易接口知识库地址：</span>
        <span v-if="!editMode.url2">
          <a v-if="popupContent.url2" :href="popupContent.url2" target="_blank">{{ popupContent.url2 }}</a>
          <span v-else>（无）</span>
        </span>
        <input v-else v-model="editValues.url2" placeholder="请输入 url2" />
        <button @click="toggleEdit('url2')" style="margin-left: 6px;">
          {{ editMode.url2 ? '取消' : '编辑' }}
        </button>
      </div>

      <!-- interfaceCode -->
      <div v-if="currentNodeLabel === '交易名称'" style="margin-bottom: 6px;">
        <span>交易编号（交易码）：</span>
        <span v-if="!editMode.interfaceCode">{{ popupContent.interfaceCode || '（无）'}}</span>
        <input v-else v-model="editValues.interfaceCode" placeholder="请输入交易编号（交易码）" />
        <button @click="toggleEdit('interfaceCode')" style="margin-left: 6px;">
          {{ editMode.interfaceCode ? '取消' : '编辑' }}
        </button>
      </div>
      <!-- transRule -->
      <div v-if="currentNodeLabel === '规则'" style="margin-bottom: 6px;">
        <span>交易规则内容：</span>
        <span v-if="!editMode.transRule">{{ popupContent.transRule || '（无）'}}</span>
        <input v-else v-model="editValues.transRule" placeholder="请输入交易规则内容" />
        <button @click="toggleEdit('transRule')" style="margin-left: 6px;">
          {{ editMode.transRule ? '取消' : '编辑' }}
        </button>
      </div>

      <div v-if="currentNodeLabel === '交易名称'" style="margin-top: 10px;">
        <button @click="showTransactionDetail">
          交易调用详情
        </button>
      </div>


      <!-- 操作按钮 -->
      <div style="margin-top: 12px;">
        <button @click="saveEdit">确定</button>
        <button @click="showDialog = false" style="margin-left: 10px;">关闭</button>
        <button @click="confirmDeleteNode" style="margin-left: 10px; color: red;">删除节点</button>
      </div>
    </div>
    <NodeEditor @nodeCreated="renderGraph" />
    <RelationEditor @nodeCreated="renderGraph" />




  </div>
</template>

<script>

import neo4j from 'neo4j-driver';
import NeoVis, {
  NEOVIS_ADVANCED_CONFIG,
} from 'neovis.js/dist/neovis.js';
import NodeEditor from './NodeEditor.vue';
import RelationEditor from './RelationEditor.vue';
import ExcelImporter from './ExcelImporter.vue';


export default {
  data() {
    return {
      currentNodeLabel: '',
      selectedSystem: 'ALL',
      systemNames: [], // ✅ 这里填写你的系统名称列表
      showDialog: false,
      popupContent: {
        name: '',
        url1: '',
        url2: '',
        interfaceCode: '',
        transRule: '',
      },


      nodeId: null, // 当前点击的节点 ID
      editValues: {
        name: '',
        url1: '',
        url2: '',
        interfaceCode: '',
        transRule: '',
      },
      editMode: {
        name: false,
        url1: false,
        url2: false,
        interfaceCode: false,
        transRule: false,
      },
      graphMode: 'OVERVIEW', // OVERVIEW | TRANSACTION_DETAIL
      focusNodeId: null,     // 当前聚焦的交易节点 id
      focusNodeName: '',     // 当前聚焦的交易名称
    };
  },
  components: {
    NodeEditor,
    RelationEditor,
    ExcelImporter
  },
  
  mounted() {
    this.fetchSystemNames().then(() => {
      this.renderGraph(); // 等系统名加载完再渲染图
    });
  },
  methods: {
    backToOverview() {
      this.graphMode = 'OVERVIEW';
      this.focusNodeId = null;
      this.focusNodeName = '';
      this.renderGraph();
    },




    showTransactionDetail() {
      // 切换图谱模式
      this.graphMode = 'TRANSACTION_DETAIL';

      // 设置聚焦节点
      this.focusNodeId = this.nodeId;
      this.focusNodeName = this.popupContent.name;

      // 关闭弹框
      this.showDialog = false;

      // 重新渲染图谱
      this.renderGraph();
    },




    toggleEdit(field) {
      if (this.editMode[field]) {
        // 点击“取消”，恢复原值
        this.editValues[field] = this.popupContent[field];
      } else {
        // 点击“编辑”，初始化编辑值
        this.editValues[field] = this.popupContent[field];
      }
      this.editMode[field] = !this.editMode[field];
    },

    startDrag(event) {
      const dialog = this.$refs.dialog;
      const offsetX = event.clientX - dialog.offsetLeft;
      const offsetY = event.clientY - dialog.offsetTop;

      const move = (e) => {
        dialog.style.left = e.clientX - offsetX + 'px';
        dialog.style.top = e.clientY - offsetY + 'px';
      };

      const up = () => {
        document.removeEventListener('mousemove', move,{ passive: true });
        document.removeEventListener('mouseup', up,{ passive: true });
      };

      document.addEventListener('mousemove', move,{ passive: true });
      document.addEventListener('mouseup', up,{ passive: true });
    },    



    async confirmDeleteNode() {
      const confirmed = confirm("⚠️ 删除节点将同时删除其所有关联关系，是否确认删除？");
      if (confirmed) {
        await this.deleteNode();
      }
    },

    async deleteNode() {
      const driver = neo4j.driver(
        "bolt://localhost:7687",
        neo4j.auth.basic("neo4j", "password")
      );
      const session = driver.session({database: 'base11'});

      try {
        const query = `
          MATCH (n)
          WHERE ID(n) = $id
          OPTIONAL MATCH (n)-[r]-()
          DELETE r, n
        `;
        await session.run(query, { id: this.nodeId });

        alert("✅ 节点及关联关系已删除！");
        this.showDialog = false;
        this.renderGraph(); // 重新加载图谱
      } catch (error) {
        console.error("❌ 删除节点失败", error);
        alert("❌ 删除失败：" + error.message);
      } finally {
        await session.close();
        await driver.close();
      }
    },



    async saveEdit() {
      const driver = neo4j.driver(
        "bolt://localhost:7687",
        neo4j.auth.basic("neo4j", "password")
      );
      const session = driver.session({database: 'base11'});

      try {
        const updates = [];
        const params = { id: this.nodeId };

        ['name', 'url1', 'url2', 'interfaceCode','transRule'].forEach(key => {
          if (this.editValues[key] !== undefined) {
            updates.push(`n.${key} = $${key}`);
            params[key] = this.editValues[key];
          }
        });

        const query = `
          MATCH (n)
          WHERE ID(n) = $id
          SET ${updates.join(', ')}
          RETURN n
        `;

        await session.run(query, params);
        alert("✅ 节点更新成功！");
        this.showDialog = false;
        this.renderGraph(); // 重新渲染
      } catch (error) {
        console.error("❌ 节点更新失败", error);
        alert("❌ 更新失败：" + error.message);
      } finally {
        await session.close();
        await driver.close();
      }
    },


    ensureFullUrl(url) {
      if (!url) return '';
      return /^https?:\/\//i.test(url) ? url : 'http://' + url;
    },


    async fetchSystemNames() {
      const driver = neo4j.driver(
        "bolt://localhost:7687",
        neo4j.auth.basic("neo4j", "password")
      );
      const session = driver.session({database: 'base11'});

      try {
        const result = await session.run(`
          MATCH (s:系统名称)
          RETURN DISTINCT s.name AS name
        `);

        this.systemNames = result.records.map(record => record.get("name"));
      } catch (error) {
        console.error("❌ 获取系统名称失败", error);
      } finally {
        await session.close();
        await driver.close();
      }
    },


    //OPTIONAL MATCH (n)-[r]->(m)
    getCypherQuery() {

      if (this.graphMode === 'TRANSACTION_DETAIL' && this.focusNodeName) {
        return `
          MATCH (t:交易名称 {name: "${this.focusNodeName}"})
          CALL apoc.path.subgraphAll(
            t,
            {
              relationshipFilter: "调用>|<调用|包含>|<包含|触发>|<触发",
              maxLevel: 2
            }
          )
          YIELD nodes, relationships
          RETURN DISTINCT nodes, relationships
        `;
      }
      if (this.selectedSystem === 'ALL') {
        return `
          MATCH (s:系统名称)
          CALL apoc.path.subgraphAll(
            s,
            {
              relationshipFilter: "包含>",
              maxLevel: 3
            }
          )
          YIELD nodes, relationships
          RETURN DISTINCT nodes, relationships
          LIMIT 500

        `;
      } 
      return `
        MATCH (s:系统名称 {name: "${this.selectedSystem}"})
        CALL apoc.path.subgraphAll(
          s,
          {
            relationshipFilter: "包含>",
            maxLevel: 4
          }
        )
        YIELD nodes, relationships
        RETURN DISTINCT nodes, relationships
      `;
    },
    renderGraph() {
      if (this._viz && this._viz.network) {
        this._viz.network.destroy();
        this._viz = null;
      };
      const config = {
        containerId: "viz",
        serverDatabase: "base11",
        neo4j: {
          driverConfig: {
            encrypted: "ENCRYPTION_OFF"
          },
          serverUrl: "bolt://localhost:7687",
          serverUser: "neo4j",
          serverPassword: "password"
          
        },
        labels: {
          系统名称: {
            label: "name",
            properties: { name: "name", url1: "url1" },
            nodes: {
              shape: "circle",
              size: 80,
              font: {
                size: 14,
                face: "Arial",
                color: "#000000",
                align: "center"
              },
              labelHighlightBold: true,
              margin: 5
            },
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: "#2980b9" }
            }
          },
          场景名称: {
            label: "name",
            properties: { name: "name", url1: "url1"},
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: "#8e44ad" }
            }
          },
          接口名称: {
            label: "name",
            properties: { name: "name", url1: "url1" },
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: "#FFB6C1" }
            }
          },
          交易名称: {
            label: "name",
            properties: { name: "name", url1: "url1", url2: "url2", interfaceCode:"interfaceCode" },
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: "#6ab04c" }
            }
          },
          规则: {
            label: "name",
            properties: { name: "name", url1: "url1", transRule:"transRule" },
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: "#FF0000" }
            }
          },
          接口入参字段名称: {
            label: "name",
            properties: { name: "name", url1: "url1" },
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: "#FF8C00" }
            }
          },
          接口回参字段名称: {
            label: "name",
            properties: { name: "name", url1: "url1" },
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: "#e6e6fa" }
            }
          },
        },
        relationships: {
          default: {
            caption: false
          },
          调用: {
            id: "ID(r)",
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: '#e67e22' }
            }
          },
          触发: {
            id: "ID(r)",
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: '#6ab04c' }
            }
          },
          包含: {
            id: "ID(r)",
            [NEOVIS_ADVANCED_CONFIG]: {
              static: { color: '#1E90FF' }
            }
          },
        },
        visConfig: {
          edges: {
            arrows: {
              to: { enabled: true, scaleFactor: 0.5 }
            },
            smooth: {
              type: "dynamic",
              forceDirection: "none",
              roundness: 0.1,
              enabled: true
            },
          },
          physics: {
            enabled: true,
            barnesHut: {
              gravitationalConstant: -9000,
              springLength: 50,
              springConstant: 0.003
            },
            solver: "forceAtlas2Based"
          },
          layout: {
            improvedLayout: true
          },
          nodes: {
            shape: "circle",
            size: 10,
            font: {
              size: 10,
              face: "Arial",
              color: "#000000",
              align: "center"
            },
            labelHighlightBold: true,
            margin: 5
          },
        },
        initialCypher: this.getCypherQuery(),
        expand: true,
      };

      // 每次渲染前清除旧图
      if (this.viz) {
        document.getElementById("viz").innerHTML = "";
      }

      this.viz = new NeoVis(config);
      this.viz.registerOnEvent("completed", (e) => {
        //console.log("🎉 图谱渲染完成");

        const allNodes = this.viz.network.body.data.nodes;
        const simplifiedNodes = [];

        allNodes.forEach((node) => {
          const props = node.properties || {};
          const lines = [];

          function truncate(text, maxLength = 6) {
            const fullWidthSpace = '　';
            const displayLength = maxLength - 1;
            return text.length > maxLength
              ? text.slice(0, displayLength) + "…"
              : text.padEnd(maxLength, fullWidthSpace);
          }

          if (props.name) {
            const truncatedName = truncate(props.name);
            node.label = truncatedName;
            lines.push(`${props.name}`);
          }

          if (props.url1) lines.push(`交易学习知识库地址: ${props.url1}`);
          if (props.url2) lines.push(`交易接口知识库地址: ${props.url2}`);
          if (props.interfaceCode) lines.push(`交易编号（交易码）: ${props.interfaceCode}`);
          if (props.transRule) lines.push(`交易规则内容: ${props.transRule}`);

          node.title = lines.join("\n");
          this.viz.network.body.data.nodes.update(node);

          simplifiedNodes.push({
            id: node.id,
            label: node.label,
            title: node.title,
            group: node.group,
            name: node.name,
            properties: node.title_properties,
          });
        });

        this.viz.network.on("click", (params) => {
          if (params.nodes && params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = this.viz.network.body.data.nodes.get(nodeId);
            const props = nodeData.properties || {};
            this.popupContent = {
              name: props.name || '',
              url1: this.ensureFullUrl(props.url1),
              url2: this.ensureFullUrl(props.url2),
              interfaceCode: props.interfaceCode,
              transRule: props.transRule

            };
            this.currentNodeLabel = nodeData.group || '';
            this.nodeId = nodeId;
            this.editValues = {
              name: props.name || '',
              url1: props.url1 || '',
              url2: props.url2 || '',
              interfaceCode: props.interfaceCode || '',
              transRule: props.transRule || ''
            };
            this.editMode = {
              name: false,
              url1: false,
              url2: false,
              interfaceCode: false,
              transRule: false
            };


            this.showDialog = true;
          }
        });




        //console.log("🧠 简化后的所有节点信息：", simplifiedNodes);
        this.viz.network.fit({ animation: true });
        const edges = this.viz.network.body.data.edges;

        edges.forEach(edge => {

          // 1. 保证 edge.id 存在
          if (!edge.id) {
            edge.id = `${edge.from}-${edge.to}-${edge.raw?.type || edge.label}`;
          }

          // 2. 获取关系类型（调用 / 包含 /触发）
          const relType = edge.raw?.type || edge.label || "???";

          // 3. 获取关系属性（Neo4j relationship properties）
          const props = edge.raw?.properties || {};

          // 4. 如果存在 order，则追加显示
          let parts = [];

          // 关系类型永远存在
          parts.push(relType);

          // 调用顺序
          if (props.order !== undefined && props.order !== null) {
            parts.push(`第${props.order}步`);
          }

          // 触发条件
          if (props.triggerCondition !== undefined && props.triggerCondition !== null) {
            parts.push(`触发条件：${props.triggerCondition}`);
          }
          if (props.senaorder !== undefined && props.senaorder !== null && props.senaorder !=='') {
            parts.push(`场景交易顺序：${props.senaorder}`);
          }

          // 调用条件
          if (props.callCondition !== undefined && props.callCondition !== null) {
            parts.push(`调用条件：${props.callCondition}`);
          }

          // 拼接显示
          let caption = parts.join(" | ");

          // 更新 edge
          edge.label = caption;
          edge.title = caption;

          // 6. 写回 vis 数据
          this.viz.network.body.data.edges.update(edge);
          console.log("节点信息：",edge);
        });
      });

      this.viz.render();
    }
  }
};
</script>
