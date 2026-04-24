// DOMAIN
X  `src/domain/types.ts`
X  `src/domain/conditions.ts`
X  `src/domain/conditionRefs.ts`
X  `src/domain/effects.ts`
X  `src/domain/effectRefs.ts`

// SCHEMAS - VALIDATOR
X  `src/validation/genericSchemas.ts`
X  `src/validation/genericValidator.ts`
X  `src/features/editor/history/music/musicSchemas.ts`
X  `src/features/editor/history/music/musicValidator.ts`
X  `src/features/editor/history/sfx/sfxSchemas.ts`
X  `src/features/editor/history/sfx/sfxValidator.ts`
X  `src/features/editor/history/items/itemSchemas.ts`
X  `src/features/editor/history/items/itemValidator.ts`
X  `src/features/editor/history/players/playerSchemas.ts`
X  `src/features/editor/history/players/playerValidator.ts`
X  `src/features/editor/history/npcs/npcSchemas.ts`
X  `src/features/editor/history/npcs/npcValidator.ts`
X  `src/features/editor/history/maps/mapSchemas.ts`
X  `src/features/editor/history/maps/mapValidator.ts`
X  `src/features/editor/history/maps/mapRegionValidator.ts`
X  `src/features/editor/scene/interactiveComponents/interactiveSchemas.ts`
X  `src/features/editor/scene/interactiveComponents/interactiveValidator.ts`
X  `src/validation/varSchemas.ts`
X  `src/validation/varValidator.ts`
X  `src/features/editor/scene/hotspots/hotspotSchemas.ts`
X  `src/features/editor/scene/hotspots/hotspotValidator.ts`
X  `src/features/editor/scene/placedItems/placedItemSchemas.ts`
X  `src/features/editor/scene/placedItems/placedItemValidator.ts`
X  `src/features/editor/scene/placedPlayers/placedPlayerSchemas.ts`
X  `src/features/editor/scene/placedPlayers/placedPlayerValidator.ts`
X  `src/features/editor/scene/placedNpcs/placedNpcSchemas.ts`
X  `src/features/editor/scene/placedNpcs/placedNpcValidator.ts`
x  `src/features/editor/scene/dialogues/dialogueSchemas.ts`
x  `src/features/editor/scene/dialogues/dialogueValidator.ts`
X  `src/features/editor/scene/node/nodeSchemas.ts`
X  `src/features/editor/scene/node/nodeValidator.ts`
X  `src/features/editor/scene/layer/sceneLayerSchema.ts`
X  `src/validation/rulesSchemas.ts`
X  `src/validation/projectSchemas.ts`
X  `src/validation/projectValidator.ts`
X  `src/validation/validateAssetBackedDraft.ts`
X  `src/shared/zodIssues.ts`

// STORE
X  `src/store/editorStore.ts`
X  `src/store/utils/editorPersistence.ts`
X  `src/store/utils/editorStoreUtils.ts`
X  `src/features/editor/core/editorGenericSlice.ts`
X  `src/features/editor/core/editorModes.ts`
-  `src/features/editor/core/editorProjectWalkers.ts`

// COMPONENTES GLOBALES
X  `src/features/editor/history/music/editorMusicSlice.ts`
X  `src/features/editor/history/music/HistoryMusicPanel.tsx`
X  `src/features/editor/history/sfx/editorSfxSlice.ts`
X  `src/features/editor/history/sfx/HistorySfxPanel.tsx`
X  `src/features/editor/history/items/editorItemsSlice.ts`
X  `src/features/editor/history/items/HistoryItemsPanel.tsx`
X  `src/features/editor/history/players/editorPlayersSlice.ts`
X  `src/features/editor/history/players/HistoryPlayersPanel.tsx`
X  `src/features/editor/history/players/playersImageDraft.ts`
X  `src/features/editor/history/npcs/editorNpcSlice.ts`
X  `src/features/editor/history/npcs/HistoryNpcsPanel.tsx`
X  `src/features/editor/history/maps/editorMapRegionSlice.ts`
X  `src/features/editor/history/maps/editorMapsSlice.ts`
X  `src/features/editor/history/maps/HistoryMapRegionPanel.tsx`
X  `src/features/editor/history/maps/HistoryMapsPanel.tsx`
X  `src/features/editor/history/maps/mapEditorTypes.ts`
X  `src/features/editor/history/maps/MapRegionCanvas.tsx`
X  `src/features/editor/history/HistoryTagsPanel.tsx`

// VIEW
X  `src/features/editor/history/view/EdgesLayer.tsx`
X  `src/features/editor/history/view/editorHistoryViewSlice.ts`
X  `src/features/editor/history/view/historyViewGeometry.ts`
X  `src/features/editor/history/view/HistoryViewPanel.tsx`
X  `src/features/editor/history/view/historyViewTypes.ts`
X  `src/features/editor/history/view/nodeLayout.ts`
X  `src/features/editor/history/view/SceneNodeCard.tsx`
X  `src/features/editor/history/view/storyGraph.ts`
X  `src/features/editor/history/view/useHistoryInteraction.ts`

// VARIOS
X  `src/features/editor/history/shared/useAssetDraftPanel.ts`
X  `src/features/editor/history/shared/useAudioFileDraft.ts`
X  `src/features/editor/history/shared/useImageFileDraft.ts`
X  `src/features/editor/hooks/useResolvedAssetUrl.ts`
X  `src/store/assets/assetPath.ts`

X  `src/features/editor/hooks/regionShape.ts`
X  `src/features/editor/hooks/useObjectContainRect.ts`
X  `src/features/editor/hooks/useRegionShapeRectDrawing.ts`
X  `src/features/editor/scene/clickableCollisions.ts`
X  `src/features/editor/scene/useEntityCollisionGuard.ts`

X  `src/features/editor/layout/BottomBar.tsx`
X  `src/features/editor/layout/EditorLayout.tsx`
X  `src/features/editor/layout/TopBar.tsx`
-  `src/features/editor/pages/EditorShell.tsx` --> Pendiente closeOrModal y Modal de shortcuts (extraer)

// MODALS
X  `src/features/editor/modals/ConfirmDangerModal.tsx`
X  `src/features/editor/modals/ConfirmExitModal.tsx`
X  `src/features/editor/modals/DeleteProjectEntityModal.tsx`
X  `src/features/editor/modals/ExitWithoutSaveModal.tsx`
X  `src/features/editor/modals/InsertTextTokenModal.tsx`
X  `src/features/editor/modals/StartConflictModal.tsx`
X  `src/features/editor/scene/rules/conditions/ConditionBuilderModal.tsx`
X  `src/features/editor/scene/rules/RuleBuilderModal.tsx`
X  `src/features/editor/scene/dialogues/DialogueEditorModal.tsx`

// SCENE
X  `src/features/editor/scene/SceneCommon.tsx`
X  `src/features/editor/scene/SceneEditorView.tsx`
X  `src/features/editor/scene/SceneFieldBlocks.tsx`
X  `src/features/editor/scene/SceneListView.tsx`
X  `src/features/editor/scene/SceneRenderPreview.tsx`
X  `src/components/SceneVariantsSection.tsx`

// FIELDS
X  `src/features/editor/scene/fields/SceneImageField.tsx`
X  `src/features/editor/scene/fields/SceneLayersField.tsx`
X  `src/features/editor/scene/fields/SceneTextField.tsx`
X  `src/features/editor/scene/fields/SceneTitleField.tsx`
X  `src/features/editor/scene/fields/SceneTypeField.tsx`
X  `src/features/editor/scene/maps/SceneMapField.tsx`
X  `src/features/editor/scene/music/SceneMusicField.tsx`
X  `src/features/editor/scene/music/useScenePreviewAudio.ts`

// DIALOGUES
X  `src/features/editor/scene/dialogues/dialogueEditorTypes.ts`
X  `src/features/editor/scene/dialogues/dialogueHelpers.ts`
X  `src/features/editor/scene/dialogues/DialogueTreeNodeCard.tsx`
X  `src/features/editor/scene/dialogues/DialogueTreeView.tsx`
X  `src/features/editor/scene/dialogues/editorDialogueSlice.ts`
X  `src/features/editor/scene/dialogues/SceneDialogueField.tsx`

// INTERACTIVE
X  `src/features/editor/scene/interactiveComponents/fieldHelpers.ts`
X  `src/features/editor/scene/interactiveComponents/InteractionRulesSection.tsx`
X  `src/features/editor/scene/interactiveComponents/interactiveEditorTypes.ts`
X  `src/features/editor/scene/interactiveComponents/InteractiveListPanel.tsx`
X  `src/features/editor/scene/interactiveComponents/PlaceableStateSection.tsx`
X  `src/features/editor/scene/interactiveComponents/RegionStatusNotice.tsx`

// HOTSPOTS
X  `src/features/editor/scene/hotspots/editorHotspotsSlice.ts`
X  `src/features/editor/scene/hotspots/HotspotEditorPanel.tsx`
X  `src/features/editor/scene/hotspots/hotspotEditorTypes.ts`
X  `src/features/editor/scene/hotspots/SceneHotspotField.tsx`

// PLACED
X  `src/features/editor/scene/placedItems/editorPlacedItemSlice.ts`
-  `src/features/editor/scene/placedItems/PlacedItemEditorPanel.tsx`
X  `src/features/editor/scene/placedItems/placedItemEditorTypes.ts`
-  `src/features/editor/scene/placedItems/PlacedItemPreview.tsx`
-  `src/features/editor/scene/placedItems/ScenePlacedItemField.tsx`

X  `src/features/editor/scene/placedNpcs/editorPlacedNpcslice.ts`
-  `src/features/editor/scene/placedNpcs/PlacedNpcEditorPanel.tsx`
X  `src/features/editor/scene/placedNpcs/placedNpcEditorTypes.ts`
-  `src/features/editor/scene/placedNpcs/PlacedNpcPreview.tsx`
-  `src/features/editor/scene/placedNpcs/ScenePlacedNpcField.tsx`

X  `src/features/editor/scene/placedPlayers/editorPlacedPlayerSlice.ts`
-  `src/features/editor/scene/placedPlayers/PlacedPlayerEditorPanel.tsx`
X  `src/features/editor/scene/placedPlayers/placedPlayerEditorTypes.ts`
-  `src/features/editor/scene/placedPlayers/PlacedPlayerPreview.tsx`
-  `src/features/editor/scene/placedPlayers/ScenePlacedPlayerField.tsx`

// RULES
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


X  `src/features/editor/scene/layer/editorLayerInteractionSlice.ts`
X  `src/features/editor/scene/layer/editorLayerSlice.ts` 
X  `src/features/editor/scene/node/editorNodeSlice.ts`

// TOKENS
X  `src/features/editor/scene/textTokens/ResolveTextTokens.tsx`
X  `src/features/editor/scene/textTokens/tokenCatalog.ts`
X  `src/features/editor/scene/textTokens/tokenFormat.ts`

// VARIOS
X  `src/features/home/components/CreateAdventureModal.tsx`
-  `src/features/home/components/UserManualModal.tsx`
X  `src/features/home/HomePage.tsx`
X  `src/services/projectDirectoryLoader.ts`
X  `src/shared/directoryImport.ts`


X  `src/components/Select.tsx`
X  `src/shared/toast/toastStore.ts`
X  `src/shared/toast/ToastViewport.tsx`
X  `src/shared/vars/useEntityVarsEditor.ts`
X  `src/shared/vars/varRow.ts`
X  `src/shared/vars/varRowCard.tsx`

X  `src/shared/keyboard.ts`
X  `src/utils/id.ts`

// PLAYER
-  `src/store/gameStore.ts`
-  `src/features/player/components/BottomBar.tsx`
-  `src/features/player/components/DialogueChoicesPanel.tsx`
-  `src/features/player/components/DialogueSpeechBubble.tsx`
-  `src/features/player/components/interactionCursors.ts`
-  `src/features/player/components/InventoryOverlay.tsx`
-  `src/features/player/components/MapOVerlay.tsx`
-  `src/features/player/components/SceneStage.tsx`
-  `src/features/player/hooks/useFullscreen.ts`
-  `src/features/player/hooks/useImageContentRect.ts`
-  `src/features/player/hooks/usePlayerKeyboard.ts`
-  `src/features/player/hooks/useSceneAudio.ts`
-  `src/features/player/PlayerShell.tsx`
-  `src/features/player/utils/playerKeyboard.ts`

// ENGINE
-  `src/engine/adapters/audioAdapter.ts`
-  `src/engine/apply/applyEffect.ts`
-  `src/engine/apply/applyHotspot.ts`
-  `src/engine/apply/applyInventoryItem.ts`
-  `src/engine/apply/applyPlacedItem.ts`
-  `src/engine/apply/applyPlacedNpc.ts`
-  `src/engine/conditions/evaluateConditions.ts`
-  `src/engine/messages/uiMessages.ts`
-  `src/engine/messages/uiMessageStore.ts`
-  `src/engine/rules.ts`
-  `src/engine/save/loadGame.ts`
-  `src/engine/save/saveGame.ts`
-  `src/engine/state/runtimeState.ts`
-  `src/engine/state/slices/musicSlice.ts`

// GENÉRICOS
X  `src/App.tsx`
-  `src/index.css`
X  `src/main.tsx`