// MODELO
X  `src/domain/conditionRefs.ts` 
X  `src/domain/conditions.ts`
X  `src/domain/effectRefs.ts`
X  `src/domain/effects.ts`
X  `src/domain/types.ts`


// INICIO
X  `src/App.tsx`
X  `src/main.tsx`
X  `src/features/home/components/CreateAdventureModal.tsx`
-  `src/features/home/components/UserManualModal.tsx` -- Adjuntar al Manual de Usuario
X  `src/features/home/HomePage.tsx`
X  `src/features/editor/pages/EditorShell.tsx`
X  `src/features/editor/layout/BottomBar.tsx`
X  `src/features/editor/layout/EditorLayout.tsx`
X  `src/features/editor/layout/TopBar.tsx`


// AYUDA INICIO
X  `src/store/editorStore.ts`
X  `src/store/assets/assetPath.ts`
X  `src/features/editor/core/editorNavigation.ts`
X  `src/store/utils/editorPersistence.ts`
X  `src/store/utils/editorStoreUtils.ts`
X  `src/services/projectDirectoryLoader.ts`
X  `src/shared/directoryImport.ts`
X  `src/shared/keyboard.ts`
X  `src/shared/toast/toastStore.ts`
X  `src/shared/toast/ToastViewport.tsx`
X  `src/shared/zodIssues.ts`
X  `src/utils/id.ts`


// VALIDACIÓN
X  `src/validation/genericSchemas.ts`
X  `src/validation/genericValidator.ts`
X  `src/validation/itemInstanceLabels.ts`
-  `src/validation/projectSchemas.ts` -- Repasar al terminar todos los componentes
-  `src/validation/projectValidator.ts` -- ¿Integrarlo al exportar?
X  `src/validation/rulesSchemas.ts`
X  `src/validation/validateAssetBackedDraft.ts`
X  `src/validation/varSchemas.ts`
X  `src/validation/varValidator.ts`


// MODALES
X  `src/features/editor/modals/ConfirmDangerModal.tsx`
X  `src/features/editor/modals/ConfirmExitModal.tsx`
X  `src/features/editor/modals/EditorKeyboardHelpModal.tsx`
X  `src/features/editor/modals/ExitWithoutSaveModal.tsx`
X  `src/features/editor/modals/InsertTextTokenModal.tsx`
X  `src/features/editor/modals/StartConflictModal.tsx`


// CG COMUNES
X  `src/features/editor/history/shared/assetBackedEntityHelpers.ts`
X  `src/features/editor/history/shared/genericHelpers.ts`
X  `src/features/editor/history/shared/useAssetDraftPanel.ts`
X  `src/features/editor/history/shared/useAudioFileDraft.ts`
X  `src/features/editor/history/shared/useImageFileDraft.ts`


// MÚSICA - SFX
X  `src/features/editor/history/music/editorMusicSlice.ts`
X  `src/features/editor/history/music/HistoryMusicPanel.tsx`
X  `src/features/editor/history/music/musicSchemas.ts`
X  `src/features/editor/history/music/musicValidator.ts`

X  `src/features/editor/history/sfx/editorSfxSlice.ts`
X  `src/features/editor/history/sfx/HistorySfxPanel.tsx`
X  `src/features/editor/history/sfx/sfxSchemas.ts`
X  `src/features/editor/history/sfx/sfxValidator.ts`


// OBJETOS - MAPAS
X  `src/features/editor/history/items/editorItemsSlice.ts`
X  `src/features/editor/history/items/HistoryItemsPanel.tsx`
X  `src/features/editor/history/items/itemSchemas.ts`
X  `src/features/editor/history/items/itemValidator.ts`

X  `src/features/editor/history/maps/mapSchemas.ts`
X  `src/features/editor/history/maps/mapValidator.ts`
X  `src/features/editor/history/maps/editorMapsSlice.ts`
X  `src/features/editor/history/maps/HistoryMapsPanel.tsx`

X  `src/features/editor/history/maps/mapRegionEditorTypes.ts`
X  `src/features/editor/history/maps/editorMapRegionSlice.ts`
X  `src/features/editor/history/maps/HistoryMapRegionPanel.tsx`
X  `src/features/editor/history/maps/MapRegionCanvas.tsx`
X  `src/features/editor/history/maps/mapRegionValidator.ts`


// PERSONAJES
X  `src/features/editor/history/npcs/editorNpcSlice.ts`
X  `src/features/editor/history/npcs/HistoryNpcsPanel.tsx`
X  `src/features/editor/history/npcs/npcSchemas.ts`
X  `src/features/editor/history/npcs/npcValidator.ts`

X  `src/features/editor/history/players/editorPlayersSlice.ts`
X  `src/features/editor/history/players/HistoryPlayersPanel.tsx`
X  `src/features/editor/history/players/playerSchemas.ts`
X  `src/features/editor/history/players/playersImageDraft.ts`
X  `src/features/editor/history/players/playerValidator.ts`

X  `features/editor/history/shared/inventory/useEntityInventorEditor`
X  `features/editor/history/shared/inventory/InventoryItemRulesEditor`
X  `features/editor/history/shared/inventory/InventorEditor`

X  `src/features/editor/history/HistoryTagsPanel.tsx`


// COMPONENTES - AYUDA
X  `src/components/Checkbox.tsx`
X  `src/components/SceneVariantsSection.tsx`
X  `src/components/Select.tsx`
X  `src/shared/vars/useEntityVarsEditor.ts`
X  `src/shared/vars/varRow.ts`
X  `src/shared/vars/varRowCard.tsx`
X  `src/features/editor/core/editorDataUtils.ts`


// BORRADO
-  `src/features/editor/delete/deleteTypes.ts`
-  `src/features/editor/delete/deleteImpactAnalyzer.ts`
-  `src/features/editor/delete/DeleteImpactModal.tsx`
-  `src/features/editor/delete/deleteReferenceCleaner.ts`
-  `src/features/editor/delete/deleteReferenceQueries.ts`

-  `src/features/editor/delete/editorDeleteSlice.ts`
-  `src/features/editor/delete/projectDiagnostics.ts`
-  `src/features/editor/core/editorProjectWalkers.ts`


// VISTA
X  `src/features/editor/history/view/historyViewTypes.ts`
X  `src/features/editor/history/view/historyViewGeometry.ts`
X  `src/features/editor/history/view/nodeLayout.ts`
X  `src/features/editor/history/view/storyGraph.ts`
X  `src/features/editor/history/view/editorHistoryViewSlice.ts`
X  `src/features/editor/history/view/useHistoryInteraction.ts`
X  `src/features/editor/history/view/SceneNodeCard.tsx`
X  `src/features/editor/history/view/EdgesLayer.tsx`
X  `src/features/editor/history/view/HistoryViewPanel.tsx`


// ESCENA
X  `src/features/editor/scene/node/nodeSchemas.ts`
X  `src/features/editor/scene/node/nodeValidator.ts`
X  `src/features/editor/scene/node/nodeHelpers.ts` -- Funciones a Delete
X  `src/features/editor/scene/node/editorNodeSlice.ts`
X  `src/features/editor/scene/SceneEditorView.tsx`
X  `src/features/editor/scene/SceneCommon.tsx`
X  `src/features/editor/scene/SceneFieldBlocks.tsx`
X  `src/features/editor/scene/fields/SceneTitleField.tsx`
X  `src/features/editor/scene/fields/SceneTypeField.tsx`


// VARIANTES
X  `src/features/editor/scene/layer/sceneLayerSchema.ts`
X  `src/features/editor/scene/node/layerHelpers.ts`
X  `src/features/editor/scene/layer/editorLayerSlice.ts`
X  `src/features/editor/scene/layer/LayerInteractionHelpers.ts`
X  `src/features/editor/scene/layer/editorLayerInteractionSlice.ts`
X  `src/features/editor/scene/fields/SceneLayersField.tsx`
X  `src/features/editor/scene/fields/SceneVariantLabelField.tsx`
X  `src/features/editor/scene/fields/SceneImageField.tsx`
X  `src/features/editor/scene/fields/SceneTextField.tsx`
X  `src/features/editor/scene/fields/layerHelpers.tsx`
X  `src/features/editor/scene/textTokens/ResolveTextTokens.tsx`
X  `src/features/editor/scene/textTokens/tokenCatalog.ts`
X  `src/features/editor/scene/textTokens/tokenFormat.ts`


// RULES
X  `src/features/editor/scene/rules/conditions/ConditionBuilderModal.tsx` 
X  `src/features/editor/scene/rules/conditions/conditionDraftMapper.ts`
X  `src/features/editor/scene/rules/conditions/ConditionGroups.tsx`
X  `src/features/editor/scene/rules/conditions/ConditionLeafEditor.tsx`
X  `src/features/editor/scene/rules/conditions/conditionLeafRegistry.ts`
X  `src/features/editor/scene/rules/conditions/conditionProjectIndex.ts`

X  `src/features/editor/scene/rules/effects/effectFactory.ts`
X  `src/features/editor/scene/rules/effects/effectFamilies.ts`
X  `src/features/editor/scene/rules/effects/EffectLeafEditor.tsx`
X  `src/features/editor/scene/rules/effects/EffectPanel.tsx`
X  `src/features/editor/scene/rules/effects/effectProjectIndex.ts`
X  `src/features/editor/scene/rules/effects/effectShared.ts`

X  `src/features/editor/scene/rules/entityRulesEditor.ts`
X  `src/features/editor/scene/rules/RuleBuilderModal.tsx`


// ELEMENTOS INTERACTIVOS COMÚN
X  `src/features/editor/scene/interactiveComponents/interactiveValidator.ts`
X  `src/features/editor/scene/interactiveComponents/interactiveEditorTypes.ts`
X  `src/features/editor/scene/interactiveComponents/interactiveEditorHelpers.ts`
X  `src/features/editor/scene/interactiveComponents/InteractionRulesSection.tsx`
X  `src/features/editor/scene/interactiveComponents/PlaceableStateSection.tsx`
X  `src/features/editor/scene/interactiveComponents/RegionStatusNotice.tsx`
X  `src/features/editor/scene/interactiveComponents/InteractiveListPanel.tsx`
X  `src/features/editor/scene/interactiveComponents/interactiveFieldHelpers.ts`
X  `src/features/editor/scene/interactiveComponents/interactiveDraftGuards.ts`
X  `src/features/editor/scene/interactiveComponents/gameItemOptions.ts`


// AYUDA SHAPE ELEMENTOS
X  `src/features/editor/hooks/useObjectContainRect.ts`
X  `src/features/editor/hooks/regionShape.ts`
X  `src/features/editor/scene/clickableCollisions.ts`
X  `src/features/editor/scene/useEntityCollisionGuard.ts`
X  `src/features/editor/hooks/useRegionShapeRectDrawing.ts`


// HOTSPOTS
X  `src/features/editor/scene/hotspots/hotspotSchemas.ts`
X  `src/features/editor/scene/hotspots/hotspotValidator.ts`
X  `src/features/editor/scene/hotspots/hotspotEditorTypes.ts`
X  `src/features/editor/scene/hotspots/editorHotspotsSlice.ts`
X  `src/features/editor/scene/hotspots/HotspotEditorPanel.tsx`
X  `src/features/editor/scene/hotspots/SceneHotspotField.tsx`


// OBJETOS INSTANCIADOS
X  `src/features/editor/scene/placedItems/placedItemSchemas.ts`
X  `src/features/editor/scene/placedItems/placedItemValidator.ts`
X  `src/features/editor/scene/placedItems/placedItemEditorTypes.ts`
X  `src/features/editor/scene/placedItems/editorPlacedItemSlice.ts`
X  `src/features/editor/scene/placedItems/PlacedItemEditorPanel.tsx`
X  `src/features/editor/scene/placedItems/ScenePlacedItemField.tsx`


// PNJ INSTANCIADOS
X  `src/features/editor/scene/placedNpcs/placedNpcSchemas.ts`
X  `src/features/editor/scene/placedNpcs/placedNpcValidator.ts`
X  `src/features/editor/scene/placedNpcs/placedNpcEditorTypes.ts`
X  `src/features/editor/scene/placedNpcs/editorPlacedNpcSlice.ts`
X  `src/features/editor/scene/placedNpcs/PlacedNpcEditorPanel.tsx`
X  `src/features/editor/scene/placedNpcs/ScenePlacedNpcField.tsx`


// JUGADORES INSTANCIADOS
X  `src/features/editor/scene/placedPlayers/placedPlayerSchemas.ts`
X  `src/features/editor/scene/placedPlayers/placedPlayerValidator.ts`
X  `src/features/editor/scene/placedPlayers/placedPlayerEditorTypes.ts`
X  `src/features/editor/scene/placedPlayers/editorPlacedPlayerSlice.ts`
X  `src/features/editor/scene/placedPlayers/PlacedPlayerEditorPanel.tsx`
X  `src/features/editor/scene/placedPlayers/ScenePlacedPlayerField.tsx`


// DIÁLOGOS
X  `src/features/editor/scene/dialogues/dialogueSchemas.ts`
X  `src/features/editor/scene/dialogues/dialogueValidator.ts`
X  `src/features/editor/scene/dialogues/dialogueEditorTypes.ts`
X  `src/features/editor/scene/dialogues/dialogueHelpers.ts`
X  `src/features/editor/scene/dialogues/editorDialogueSlice.ts`
X  `src/features/editor/scene/dialogues/DialogueTreeNodeContent.tsx`
X  `src/features/editor/scene/dialogues/DialogueTreeNodeCard.tsx`
X  `src/features/editor/scene/dialogues/DialogueTreeView.tsx`
X  `src/features/editor/scene/dialogues/DialogueEditorModal.tsx`
X  `src/features/editor/scene/dialogues/SceneDialogueField.tsx`


// MAPA - MÚSICA - PREVIEW - LIST
X  `src/features/editor/scene/maps/SceneMapField.tsx` -- Definir la verdad de isEntry
X  `src/features/editor/scene/music/SceneMusicField.tsx`
X  `src/features/editor/scene/music/useScenePreviewAudio.ts`
X  `src/features/editor/scene/preview/previewRenderH-elpers.ts`
X  `src/features/editor/scene/preview/PlacedItemPreview.tsx`
X  `src/features/editor/scene/preview/PlacedNpcPreview.tsx`
X  `src/features/editor/scene/preview/PlacedPlayerPreview.tsx`
X  `src/features/editor/hooks/useResolvedAssetUrl.ts`
X  `src/features/editor/scene/preview/useSceneRenderPreviewInteractions.ts`
X  `src/features/editor/scene/preview/SceneRenderPreview.tsx`
X  `src/features/editor/scene/SceneListView.tsx`
X  `src/features/editor/scene/list/sceneListViewModel.ts`


// TEST
X  `src/features/editor/scene/test/sceneTestTypes.ts`
X  `src/features/editor/scene/test/sceneTestFormatters.ts`
X  `src/features/editor/scene/test/sceneTestViewModel.ts`
X `src/features/editor/scene/test/editorTestSlice.ts`
X  `src/features/editor/scene/test/SceneTestView.tsx`
X  `src/features/editor/scene/test/SceneTest.tsx`
X  `src/features/editor/scene/test/SceneTestInfoCard.tsx`
X  `src/features/editor/scene/test/SceneTestToolbar.tsx`


// ENGINE
X  `src/engine/state/runtimeState.ts` 
X  `src/store/gameStore.ts`
X  `src/store/gameStoreHelpers.ts`
X  `src/engine/rules.ts` 
X  `src/engine/conditions/evaluateConditions.ts` 
X  `src/engine/apply/applyEffect.ts` 
X  `src/engine/apply/applyHotspot.ts`
X  `src/engine/apply/applyInventoryItem.ts`
X  `src/engine/apply/applyPlacedItem.ts` 
X  `src/engine/apply/applyPlacedNpc.ts`
X - `src/engine/apply/applyHelpers.ts` 
X  `src/engine/messages/uiMessages.ts`
X  `src/engine/messages/uiMessageStore.ts`
X  `src/engine/adapters/SfxAdapter.ts` 
X  `src/engine/state/slices/musicSlice.ts`
X `src/engine/save/saveGame.ts`
X `src/engine/save/loadGame.ts`


// PLAYER
X  `src/features/player/PlayerShell.tsx`
X  `src/features/player/components/SceneStage.tsx`

X  `src/features/player/hooks/usePlayerResolvedAssets.ts`
X  `src/features/player/hooks/usePlayerTextDockLayout.ts`
X  `src/features/player/hooks/usePlayerSpeechDisplay.ts`
X  `src/features/player/hooks/usePlayerMusicController.ts`
X  `src/features/player/hooks/usePlayerOverlayState.ts`
X  `src/features/player/hooks/useSceneInteractionReveal.ts`

X  `src/features/player/components/interactive/HotspotLayer.tsx`
X  `src/features/player/components/interactive/PlacedItemLayer.tsx`
X  `src/features/player/components/interactive/PlacedNpcLayer.tsx` 
X  `src/features/player/components/interactive/PlacedPlayerLayer.tsx`
X  `src/features/player/components/interactive/interactiveLayerShared.tsx`

X  `src/features/player/hooks/usePlayerDisplayedNode.ts` 
X  `src/features/player/hooks/usePlayerSceneViewModel.ts`
X  `src/features/player/utils/playerSceneResolution.ts` 
X  `src/features/player/utils/playerAssetResolution.ts` 
X  `src/features/player/hooks/useImageContentRect.ts` 

X  `src/features/player/components/interactionCursors.ts` 
X  `src/features/player/hooks/usePlayerCursor.ts` 

X  `src/features/player/components/InventoryOverlay.tsx` 
X  `src/features/player/hooks/usePlayerInventoryView.ts` 
X  `src/features/player/hooks/usePlayerItemInteraction.ts` 

X  `src/features/player/components/MapOVerlay.tsx`

X  `src/features/player/components/PlayerBottomBar.tsx`
X  `src/features/player/components/PlayerSettingsOverlay.tsx`
X  `src/features/player/hooks/usePlayerKeyboard.ts`
X  `src/features/player/hooks/useFullscreen.ts`

X  `src/features/player/hooks/useSceneAudio.ts`

X  `src/features/player/utils/playerDialogueResolution.ts`
X  `src/features/player/components/DialogueChoicesPanel.tsx`
X  `src/features/player/components/DialogueSpeechBubble.tsx`
X  `src/features/player/components/PlayerOverlays.tsx`


-  `src/index.css`