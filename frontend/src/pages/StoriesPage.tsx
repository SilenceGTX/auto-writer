/** Works management page for creating and browsing novel projects. */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Button,
  Card,
  CardBody,
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
  Textarea,
  useDisclosure,
} from "@heroui/react";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  createSeries,
  createStory,
  deleteStory,
  listSeries,
  listStories,
  type Series,
  type Story,
} from "../api";

const structures = ["经典三幕式", "起承转合", "英雄之旅", "斯奈德节拍表"];

/** Render the main story management workflow. */
export function StoriesPage(): ReactElement {
  const createModal = useDisclosure();
  const [stories, setStories] = useState<Story[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [searchText, setSearchText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [structure, setStructure] = useState("经典三幕式");
  const [chapterGoal, setChapterGoal] = useState("12");
  const [seriesId, setSeriesId] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [error, setError] = useState("");

  const totalWords = useMemo(
    () => stories.reduce((total, story) => total + story.word_count, 0),
    [stories],
  );

  /** Load stories and series from the backend. */
  const loadData = useCallback(async () => {
    try {
      setError("");
      const [storyItems, seriesItems] = await Promise.all([
        listStories(searchText || undefined),
        listSeries(),
      ]);
      setStories(storyItems);
      setSeries(seriesItems);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "无法连接后端服务");
    }
  }, [searchText]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /** Create a new series and select it in the form. */
  async function handleCreateSeries(): Promise<void> {
    if (!newSeriesName.trim()) {
      return;
    }

    const created = await createSeries(newSeriesName.trim());
    setSeries((current) => [created, ...current]);
    setSeriesId(String(created.id));
    setNewSeriesName("");
  }

  /** Submit the new story form to the backend. */
  async function handleCreateStory(): Promise<void> {
    if (!title.trim()) {
      return;
    }

    await createStory({
      title: title.trim(),
      description,
      structure,
      chapter_goal: Number(chapterGoal) || 0,
      series_id: seriesId ? Number(seriesId) : null,
    });

    setTitle("");
    setDescription("");
    setChapterGoal("12");
    setSeriesId("");
    createModal.onClose();
    await loadData();
  }

  /** Delete a story after the browser confirmation prompt. */
  async function handleDeleteStory(story: Story): Promise<void> {
    const confirmed = window.confirm(`确定要删除作品「${story.title}」吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    await deleteStory(story.id);
    await loadData();
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>作品</h1>
          <p>创建作品、选择故事结构，并进入大纲或写作流程。</p>
        </div>
        <Button color="primary" startContent={<Plus size={18} />} onPress={createModal.onOpen}>
          新建作品
        </Button>
      </div>

      <div className="stats-row">
        <div>
          <strong>{stories.length}</strong>
          <span>作品数量</span>
        </div>
        <div>
          <strong>{totalWords.toLocaleString()}</strong>
          <span>累计字数</span>
        </div>
      </div>

      <Input
        className="search-input"
        placeholder="搜索作品名称"
        startContent={<Search size={18} />}
        value={searchText}
        onValueChange={setSearchText}
      />

      {error && <p className="error-text">{error}</p>}

      <div className="story-grid">
        {stories.map((story) => (
          <Card key={story.id} shadow="sm" className="story-card">
            <CardHeader className="story-card-header">
              <div>
                <h2>{story.title}</h2>
                <p>{story.series?.name ?? "独立作品"}</p>
              </div>
              <Chip color="primary" variant="flat">
                {story.status}
              </Chip>
            </CardHeader>
            <CardBody className="story-card-body">
              <p>{story.description || "尚未填写作品简介。"}</p>
              <div className="story-meta">
                <Chip size="sm" variant="flat">
                  {story.structure || "未设置结构"}
                </Chip>
                <Chip size="sm" variant="flat">
                  目标 {story.chapter_goal || 0} 章
                </Chip>
                <Chip size="sm" variant="flat">
                  {story.word_count.toLocaleString()} 字
                </Chip>
              </div>
              <div className="story-actions">
                <Button size="sm" variant="flat">
                  大纲
                </Button>
                <Button size="sm" color="primary">
                  写作
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  color="danger"
                  variant="light"
                  aria-label="删除作品"
                  onPress={() => void handleDeleteStory(story)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {!stories.length && !error && (
        <div className="empty-state">
          <h2>还没有作品</h2>
          <p>从一个标题、故事结构和简短简介开始。</p>
        </div>
      )}

      <Modal isOpen={createModal.isOpen} onOpenChange={createModal.onOpenChange} size="2xl">
        <ModalContent>
          <ModalHeader>新建作品</ModalHeader>
          <ModalBody className="modal-form">
            <Input label="作品名称" value={title} onValueChange={setTitle} />
            <div className="form-grid">
              <Select
                label="故事结构"
                selectedKeys={[structure]}
                onSelectionChange={(keys) => setStructure(String(Array.from(keys)[0]))}
              >
                {structures.map((item) => (
                  <SelectItem key={item}>{item}</SelectItem>
                ))}
              </Select>
              <Input
                label="目标章节数"
                type="number"
                value={chapterGoal}
                onValueChange={setChapterGoal}
              />
            </div>
            <div className="form-grid">
              <Select
                label="所属系列"
                placeholder="可选"
                selectedKeys={seriesId ? [seriesId] : []}
                onSelectionChange={(keys) => setSeriesId(String(Array.from(keys)[0] ?? ""))}
              >
                {series.map((item) => (
                  <SelectItem key={String(item.id)}>{item.name}</SelectItem>
                ))}
              </Select>
              <Input
                label="新系列"
                value={newSeriesName}
                onValueChange={setNewSeriesName}
                endContent={
                  <Button size="sm" variant="flat" onPress={() => void handleCreateSeries()}>
                    创建
                  </Button>
                }
              />
            </div>
            <Textarea
              label="故事简介"
              minRows={4}
              value={description}
              onValueChange={setDescription}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={createModal.onClose}>
              取消
            </Button>
            <Button color="primary" onPress={() => void handleCreateStory()}>
              创建作品
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}
