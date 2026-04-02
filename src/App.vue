<template>
  <GraphViewer />
</template>
<script>
import GraphViewer from './components/GraphViewer.vue';
import NodeEditor from './components/NodeEditor.vue';
import RelationEditor from './components/RelationEditor.vue';
export default { components: { GraphViewer, NodeEditor, RelationEditor } }
</script>