/** Works management page — NextUI themed card grid + table view. */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tab,
  Tabs,
  Textarea,
  Tooltip,
  useDisclosure,
} from "@nextui-org/react";
import {
  createSeries,
  createStory,
  deleteStory,
  listSeries,
  listStories,
  type Series,
  type Story,
} from "../api";
import ConfirmDialog from "../components/ConfirmDialog";

interface StructureDef {
  name: string;
  phases: string[];
  desc?: string;
}

const DEFAULT_STRUCTURES: StructureDef[] = [
  {
    name: "经典三幕式", phases: ["铺垫", "对抗", "结局"],
    desc: "最通用的故事骨架。「铺垫—对抗—结局」三部分，广泛应用于小说和电影。",
  },
  {
    name: "起承转合", phases: ["起", "承", "转", "合"],
    desc: "东方经典范式。「起—承—转—合」，适合短中篇、注重意境的作品。",
  },
  {
    name: "英雄之旅",
    phases: ["平凡世界", "冒险的召唤", "拒绝召唤", "遇见导师", "跨越第一道门槛", "考验、盟友与敌人", "接近深洞穴", "严峻考验", "获得奖赏", "返回之路", "复活与净化", "带着灵药归来"],
    desc: "「平凡人成为英雄」的标准模板。12 阶段，特别适合玄幻、奇幻、成长冒险。",
  },
  {
    name: "斯奈德节拍表",
    phases: ["开场画面", "主题陈述", "铺垫", "催化剂", "行动决策", "第二幕衔接", "B 故事", "趣味与游戏", "中点", "反派之路", "一败涂地", "灵魂暗夜", "第三幕衔接", "结局", "终场画面"],
    desc: "好莱坞编剧指南。15 个关键节拍精确控制节奏，适合追求商业节奏的写作。",
  },
];

function StoriesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("recent");
  const [stories, setStories] = useState<Story[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  // modals
  const createModal = useDisclosure();
  const seriesModal = useDisclosure();
  const structureModal = useDisclosure();

  // filters
  const [search, setSearch] = useState("");
  const [filterSeries, setFilterSeries] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // create dialog
  const [newTitle, setNewTitle] = useState("");
  const [newSeriesId, setNewSeriesId] = useState<string>("");
  const [newStructure, setNewStructure] = useState("");
  const [newChapterGoal, setNewChapterGoal] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // structure options
  const [structureOptions, setStructureOptions] = useState<StructureDef[]>(() => {
    const saved = localStorage.getItem("aw-structures");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const defaultMap = new Map(DEFAULT_STRUCTURES.map((d) => [d.name, d]));
        const custom = parsed.filter((s: StructureDef) => !defaultMap.has(s.name));
        return [...DEFAULT_STRUCTURES, ...custom];
      } catch { return DEFAULT_STRUCTURES; }
    }
    return DEFAULT_STRUCTURES;
  });
  const [newStructureDesc, setNewStructureDesc] = useState("");
  const [newStructureName, setNewStructureName] = useState("");
  const [newStructurePhases, setNewStructurePhases] = useState("");

  // new series
  const [newSeriesName, setNewSeriesName] = useState("");

  // delete
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const fetchData = useCallback(async () => {
    const [s, series] = await Promise.all([listStories(), listSeries()]);
    setStories(s);
    setSeriesList(series);
  }, []);

  const fetchFiltered = useCallback(async () => {
    const s = await listStories({
      search: search || undefined,
      series_id: filterSeries ? Number(filterSeries) : undefined,
      status: filterStatus || undefined,
    });
    setStories(s);
  }, [search, filterSeries, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === "all") fetchFiltered(); }, [tab, fetchFiltered]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createStory(
      newTitle.trim(),
      newSeriesId ? Number(newSeriesId) : undefined,
      newStructure || undefined,
      newDescription.trim() || undefined,
      newChapterGoal ? Number(newChapterGoal) : undefined,
    );
    setNewTitle("");
    setNewSeriesId("");
    setNewStructure("");
    setNewChapterGoal("");
    setNewDescription("");
    createModal.onClose();
    fetchData();
  };

  const handleAddStructure = () => {
    if (!newStructureName.trim()) return;
    const phases = newStructurePhases.split("-").map((p) => p.trim()).filter(Boolean);
    const updated = [...structureOptions, { name: newStructureName.trim(), phases }];
    setStructureOptions(updated);
    localStorage.setItem("aw-structures", JSON.stringify(updated));
    setNewStructure(newStructureName.trim());
    setNewStructureName("");
    setNewStructurePhases("");
    setNewStructureDesc("");
    structureModal.onClose();
  };

  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) return;
    const s = await createSeries(newSeriesName.trim());
    setNewSeriesName("");
    seriesModal.onClose();
    setSeriesList((prev) => [...prev, s]);
    setNewSeriesId(String(s.id));
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteStory(deleteTarget.id);
    setDeleteTarget(null);
    fetchData();
  };

  const totalWords = stories.reduce((sum, s) => sum + (s.word_count || 0), 0);
  const selectedStructure = structureOptions.find((o) => o.name === newStructure);
  const seriesItems = [{ key: "", label: "无" }, ...seriesList.map((s) => ({ key: String(s.id), label: s.name }))];
  const seriesSelectItems = seriesList.map((s) => ({ key: String(s.id), label: s.name }));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">作品</h1>
        <Button color="primary" onPress={() => createModal.onOpen()}>+ 新建作品</Button>
      </div>

      {/* Stats */}
      <div className="flex gap-6 text-sm text-zinc-500 mb-6">
        <span>共 {stories.length} 部作品</span>
        <span>累计 {totalWords.toLocaleString()} 字</span>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(k) => setTab(k as string)}
        className="mb-4"
        variant="underlined"
        color="primary"
      >
        <Tab key="recent" title="最近作品" />
        <Tab key="all" title="全部作品" />
      </Tabs>

      {/* Recent — Card Grid */}
      {tab === "recent" && (
        <div>
          {stories.length === 0 ? (
            <p className="text-zinc-400 text-center mt-20">暂无作品，点击「+ 新建作品」开始创作</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stories.map((s) => (
                <Card key={s.id} className="p-1" shadow="sm">
                  <CardHeader className="flex flex-col items-start gap-1 pb-0">
                    {s.series && <p className="text-xs text-zinc-400">{s.series.name}</p>}
                    <p className="text-lg font-semibold">{s.title}</p>
                  </CardHeader>
                  <CardBody className="py-1">
                    <div className="flex flex-wrap gap-1.5">
                      <Chip size="sm" variant="flat">第 {s.current_chapter || 0} 章</Chip>
                      <Chip size="sm" variant="flat">{(s.word_count || 0).toLocaleString()} 字</Chip>
                      {s.structure && <Chip size="sm" variant="flat" color="secondary">{s.structure}</Chip>}
                      <Chip size="sm" color={s.status === "完结" ? "success" : "primary"} variant="flat">
                        {s.status || "连载"}
                      </Chip>
                    </div>
                  </CardBody>
                  <CardFooter className="flex justify-between pt-1">
                    <span className="text-xs text-zinc-400">
                      {s.updated_at ? s.updated_at.slice(0, 10) : "-"}
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="light" onPress={() => navigate(`/outline?story=${s.id}`)}>大纲</Button>
                      <Button size="sm" variant="light" onPress={() => navigate(`/write?story=${s.id}`)}>写作</Button>
                      <Button size="sm" variant="light" color="danger" onPress={() => setDeleteTarget({ id: s.id, title: s.title })}>删除</Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All — Table */}
      {tab === "all" && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <Input
              className="max-w-xs"
              size="sm"
              placeholder="搜索作品名称..."
              value={search}
              onValueChange={setSearch}
            />
            <Select
              className="max-w-[160px]"
              size="sm"
              placeholder="全部系列"
              selectedKeys={filterSeries ? [filterSeries] : []}
              onSelectionChange={(keys) => setFilterSeries(Array.from(keys)[0] as string || "")}
            >
              {seriesSelectItems.map((s) => (
                <SelectItem key={s.key}>{s.label}</SelectItem>
              ))}
            </Select>
            <Select
              className="max-w-[130px]"
              size="sm"
              placeholder="全部状态"
              selectedKeys={filterStatus ? [filterStatus] : []}
              onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string || "")}
            >
              <SelectItem key="连载">连载</SelectItem>
              <SelectItem key="完结">完结</SelectItem>
            </Select>
          </div>

          <Table aria-label="作品列表" removeWrapper shadow="sm">
            <TableHeader>
              <TableColumn>系列</TableColumn>
              <TableColumn>作品名称</TableColumn>
              <TableColumn>进度</TableColumn>
              <TableColumn>字数</TableColumn>
              <TableColumn>状态</TableColumn>
              <TableColumn>最后编辑</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无匹配作品">
              {stories.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.series?.name || "-"}</TableCell>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell>第 {s.current_chapter || 0} 章</TableCell>
                  <TableCell>{(s.word_count || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip size="sm" color={s.status === "完结" ? "success" : "primary"} variant="flat">
                      {s.status || "连载"}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400">
                    {s.updated_at ? s.updated_at.slice(0, 10) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="light" onPress={() => navigate(`/outline?story=${s.id}`)}>大纲</Button>
                      <Button size="sm" variant="light" onPress={() => navigate(`/write?story=${s.id}`)}>写作</Button>
                      <Button size="sm" variant="light" color="danger" onPress={() => setDeleteTarget({ id: s.id, title: s.title })}>删除</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModal.isOpen} onOpenChange={createModal.onOpenChange} size="lg">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">新建作品</ModalHeader>
          <ModalBody className="gap-4">
            <Input
              autoFocus
              label="作品名称"
              value={newTitle}
              onValueChange={setNewTitle}
              placeholder="输入作品标题..."
            />
            <div className="flex items-end gap-2">
              <Select
                className="flex-1"
                label="所属系列（可选）"
                selectedKeys={newSeriesId ? [newSeriesId] : []}
                onSelectionChange={(keys) => setNewSeriesId(Array.from(keys)[0] as string || "")}
              >
                {seriesItems.map((s) => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>
              <Button variant="light" size="sm" onPress={() => seriesModal.onOpen()}>+ 新建系列</Button>
            </div>

            <div className="flex items-end gap-2">
              <Select
                className="flex-1"
                label="故事结构"
                selectedKeys={newStructure ? [newStructure] : []}
                onSelectionChange={(keys) => setNewStructure(Array.from(keys)[0] as string || "")}
              >
                {structureOptions.map((s) => (
                  <SelectItem key={s.name}>{s.name}</SelectItem>
                ))}
              </Select>
              <Tooltip content="新建自定义故事结构">
                <Button variant="light" size="sm" onPress={() => structureModal.onOpen()}>+ 新结构</Button>
              </Tooltip>
            </div>

            {selectedStructure?.desc && (
              <div className="p-3 bg-blue-50 border-l-3 border-blue-500 rounded-r text-sm text-zinc-600">
                {selectedStructure.desc}
              </div>
            )}
            {selectedStructure && selectedStructure.phases.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedStructure.phases.map((p, i) => (
                  <Chip key={i} size="sm" variant="flat" color="primary">{p}</Chip>
                ))}
              </div>
            )}

            <Input
              type="number"
              label="大致章节数量（可选）"
              value={newChapterGoal}
              onValueChange={setNewChapterGoal}
              placeholder="如 12"
            />
            <Textarea
              label="故事简介"
              value={newDescription}
              onValueChange={setNewDescription}
              placeholder="简要描述故事内容..."
              minRows={3}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => createModal.onClose()}>取消</Button>
            <Button color="primary" onPress={handleCreate}>创建作品</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Series Modal */}
        <Modal isOpen={seriesModal.isOpen} onOpenChange={seriesModal.onOpenChange} size="sm">
        <ModalContent>
          <ModalHeader>新建系列</ModalHeader>
          <ModalBody>
            <Input
              autoFocus
              label="系列名称"
              value={newSeriesName}
              onValueChange={setNewSeriesName}
              placeholder="输入系列名称..."
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => seriesModal.onClose()}>取消</Button>
            <Button color="primary" onPress={handleCreateSeries}>创建</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Structure Modal */}
      <Modal isOpen={structureModal.isOpen} onOpenChange={structureModal.onOpenChange} size="lg">
        <ModalContent>
          <ModalHeader>新建故事结构</ModalHeader>
          <ModalBody className="gap-4">
            <Input
              autoFocus
              label="结构名称"
              value={newStructureName}
              onValueChange={setNewStructureName}
              placeholder="如 五幕式"
            />
            <Input
              label="具体结构（阶段以 - 分隔）"
              value={newStructurePhases}
              onValueChange={setNewStructurePhases}
              placeholder="如 开端-发展-高潮-回落-结局"
            />
            <Textarea
              label="额外描述（可选）"
              value={newStructureDesc}
              onValueChange={setNewStructureDesc}
              placeholder="简要描述这个结构..."
              minRows={2}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => structureModal.onClose()}>取消</Button>
            <Button color="primary" onPress={handleAddStructure}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={<>确定要删除作品「<strong>{deleteTarget?.title}</strong>」吗？</>}
        confirmLabel="删除"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default StoriesPage;
