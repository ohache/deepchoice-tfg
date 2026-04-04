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
-  `src/features/editor/core/editorGenericSlice.ts`
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
X  `src/features/editor/pages/EditorShell.tsx`

// MODALS (4)
-  `src/features/editor/modals/ConfirmDangerModal.tsx`
-  `src/features/editor/modals/ConfirmExitModal.tsx`
-  `src/features/editor/modals/DeleteProjectEntityModal.tsx`
-  `src/features/editor/modals/ExitWithoutSaveModal.tsx`
-  `src/features/editor/modals/InsertTextTokenModal.tsx`
-  `src/features/editor/modals/StartConflictModal.tsx`
-  `src/features/editor/scene/rules/conditions/ConditionBuilderModal.tsx`
-  `src/features/editor/scene/rules/RuleBuilderModal.tsx`
-  `src/features/editor/scene/dialogues/DialogueEditorModal.tsx`

// SCENE (4)
-  `src/features/editor/scene/SceneCommon.tsx`
-  `src/features/editor/scene/SceneEditorView.tsx`
-  `src/features/editor/scene/SceneFieldBlocks.tsx`
-  `src/features/editor/scene/SceneListView.tsx`
-  `src/features/editor/scene/SceneRenderPreview.tsx`
-  `src/components/SceneVariantsSection.tsx`

// FIELDS (5)
-  `src/features/editor/scene/fields/SceneImageField.tsx`
-  `src/features/editor/scene/fields/SceneLayersField.tsx`
-  `src/features/editor/scene/fields/SceneTextField.tsx`
-  `src/features/editor/scene/fields/SceneTitleField.tsx`
-  `src/features/editor/scene/fields/SceneTypeField.tsx`
-  `src/features/editor/scene/maps/SceneMapField.tsx`
-  `src/features/editor/scene/music/SceneMusicField.tsx`
-  `src/features/editor/scene/music/useScenePreviewAudio.ts`

// DIALOGUES (6)
-  `src/features/editor/scene/dialogues/DialogueEditorPanel.tsx`
-  `src/features/editor/scene/dialogues/dialogueEditorTypes.ts`
-  `src/features/editor/scene/dialogues/dialogueHelpers.ts`
-  `src/features/editor/scene/dialogues/DialogueListPanel.tsx`
-  `src/features/editor/scene/dialogues/DialogueTreeNodeCard.tsx`
-  `src/features/editor/scene/dialogues/DialogueTreeView.tsx`
-  `src/features/editor/scene/dialogues/editorDialogueSlice.ts`
-  `src/features/editor/scene/dialogues/SceneDialogueField.tsx`

// INTERACTIVE (6)
-  `src/features/editor/scene/interactiveComponents/fieldHelpers.ts`
-  `src/features/editor/scene/interactiveComponents/InteractionRulesSection.tsx`
-  `src/features/editor/scene/interactiveComponents/interactiveEditorTypes.ts`
-  `src/features/editor/scene/interactiveComponents/InteractiveListPanel.tsx`
-  `src/features/editor/scene/interactiveComponents/PlaceableStateSection.tsx`
-  `src/features/editor/scene/interactiveComponents/RegionStatusNotice.tsx`

// HOTSPOTS (6)
-  `src/features/editor/scene/hotspots/editorHotspotsSlice.ts`
-  `src/features/editor/scene/hotspots/HotspotEditorPanel.tsx`
-  `src/features/editor/scene/hotspots/hotspotEditorTypes.ts`
-  `src/features/editor/scene/hotspots/HotspotListPanel.tsx`
-  `src/features/editor/scene/hotspots/SceneHotspotField.tsx`

// PLACED (10)
-  `src/features/editor/scene/placedItems/editorPlacedItemSlice.ts`
-  `src/features/editor/scene/placedItems/PlacedItemEditorPanel.tsx`
-  `src/features/editor/scene/placedItems/placedItemEditorTypes.ts`
-  `src/features/editor/scene/placedItems/PlacedItemListPanel.tsx`
-  `src/features/editor/scene/placedItems/PlacedItemPreview.tsx`
-  `src/features/editor/scene/placedItems/ScenePlacedItemField.tsx`
-  `src/features/editor/scene/placedNpcs/editorPlacedNpcslice.ts`
-  `src/features/editor/scene/placedNpcs/PlacedNpcEditorPanel.tsx`
-  `src/features/editor/scene/placedNpcs/placedNpcEditorTypes.ts`
-  `src/features/editor/scene/placedNpcs/PlacedNpcListPanel.tsx`
-  `src/features/editor/scene/placedNpcs/PlacedNpcPreview.tsx`
-  `src/features/editor/scene/placedNpcs/ScenePlacedNpcField.tsx`
-  `src/features/editor/scene/placedPlayers/editorPlacedPlayerSlice.ts`
-  `src/features/editor/scene/placedPlayers/PlacedPlayerEditorPanel.tsx`
-  `src/features/editor/scene/placedPlayers/placedPlayerEditorTypes.ts`
-  `src/features/editor/scene/placedPlayers/PlacedPlayerListPanel.tsx`
-  `src/features/editor/scene/placedPlayers/PlacedPlayerPreview.tsx`
-  `src/features/editor/scene/placedPlayers/ScenePlacedPlayerField.tsx`

// RULES (15)
-  `src/features/editor/scene/rules/conditions/conditionDraftMapper.ts`
-  `src/features/editor/scene/rules/conditions/ConditionGroups.tsx`
-  `src/features/editor/scene/rules/conditions/ConditionLeafEditor.tsx`
-  `src/features/editor/scene/rules/conditions/conditionLeafRegistry.ts`
-  `src/features/editor/scene/rules/conditions/conditionProjectIndex.ts`
-  `src/features/editor/scene/rules/effects/effectFactory.ts`
-  `src/features/editor/scene/rules/effects/effectFamilies.ts`
-  `src/features/editor/scene/rules/effects/EffectLeafEditor.tsx`
-  `src/features/editor/scene/rules/effects/EffectPanel.tsx`
-  `src/features/editor/scene/rules/effects/effectProjectIndex.ts`
-  `src/features/editor/scene/rules/effects/effectShared.ts`
-  `src/features/editor/scene/rules/entityRulesEditor.ts`


-  `src/features/editor/scene/layer/editorLayerInteractionSlice.ts`
-  `src/features/editor/scene/layer/editorLayerSlice.ts`  --> ¿Mover assetBackground de EditorStore?
-  `src/features/editor/scene/node/editorNodeSlice.ts`

// TOKENS (16)
-  `src/features/editor/scene/textTokens/ResolveTextTokens.tsx`
-  `src/features/editor/scene/textTokens/tokenCatalog.ts`
-  `src/features/editor/scene/textTokens/tokenFormat.ts`


-  `src/features/home/components/CreateAdventureModal.tsx`
-  `src/features/home/components/UserManualModal.tsx`
-  `src/features/home/HomePage.tsx` -->
-  `src/services/projectDirectoryLoader.ts`
-  `src/shared/directoryImport.ts`


-  `src/components/Select.tsx`
-  `src/shared/toast/toastStore.ts`
-  `src/shared/toast/ToastViewport.tsx`
-  `src/shared/vars/useEntityVarsEditor.ts`
-  `src/shared/vars/varRow.ts`
-  `src/shared/vars/varRowCard.tsx`

-  `src/shared/keyboard.ts`
-  `src/utils/id.ts`

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


-  `src/App.tsx`
-  `src/index.css`
-  `src/main.tsx`