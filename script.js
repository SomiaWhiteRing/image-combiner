const GRID_CONFIG = {
  columns: 4,  // 每行显示的图片数
  cellWidth: 200,  // 单元格宽度
  cellHeight: 200, // 单元格高度
  gap: 10  // 间距
};

let images = [];
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

// 在文件开头添加一个变量来存储最新的拼接结果
let lastMergedImage = null;

// 拖放功能
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

document.addEventListener('paste', (e) => {
  e.preventDefault();
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;

  for (const item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => {
        addImage(e.target.result);
      };
      reader.readAsDataURL(blob);
    }
  }
});

// 添加复制事件监听
document.addEventListener('copy', async (e) => {
  if (lastMergedImage) {
    e.preventDefault();
    try {
      // 将 base64 转换为 blob
      const response = await fetch(lastMergedImage);
      const blob = await response.blob();

      // 创建 ClipboardItem
      const item = new ClipboardItem({
        [blob.type]: blob
      });

      // 复制到剪贴板
      await navigator.clipboard.write([item]);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }
});

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        addImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  });
}

function updateGridLayout() {
  const containers = Array.from(document.querySelectorAll('.image-container'));
  containers.forEach((container, index) => {
    const row = Math.floor(index / GRID_CONFIG.columns);
    const col = index % GRID_CONFIG.columns;
    const left = col * (GRID_CONFIG.cellWidth + GRID_CONFIG.gap);
    const top = row * (GRID_CONFIG.cellHeight + GRID_CONFIG.gap);

    // 如果不拖动状态，则更新位置
    if (!container.isDragging) {
      container.style.transition = 'transform 0.2s';
      container.style.left = left + 'px';
      container.style.top = top + 'px';
    }
    container.originalIndex = index;
    container.originalPosition = { left, top };
  });
}

function addImage(src) {
  if (dropzone.innerText.includes('将图片拖放到这里')) {
    dropzone.innerText = '';
  }

  const container = document.createElement('div');
  container.className = 'image-container';

  const img = document.createElement('img');
  img.src = src;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.innerHTML = '×';
  deleteBtn.onclick = () => {
    container.remove();
    if (dropzone.querySelectorAll('.image-container').length === 0) {
      dropzone.innerText = '将图片拖放到这里、粘贴图片或点击选择图片';
    }
    updateGridLayout();
  };

  container.appendChild(img);
  container.appendChild(deleteBtn);
  dropzone.appendChild(container);

  makeDraggable(container);
  updateGridLayout();
}

function makeDraggable(element) {
  let startX, startY;
  let originalX, originalY;

  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    if (e.target.className === 'delete-btn') return;
    e.preventDefault();

    element.isDragging = true;
    element.style.transition = 'none';
    element.style.zIndex = '1000';

    originalX = element.offsetLeft;
    originalY = element.offsetTop;
    startX = e.clientX - originalX;
    startY = e.clientY - originalY;

    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();

    const newX = e.clientX - startX;
    const newY = e.clientY - startY;

    // 更新拖动元素位置
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';

    // 计算当前位置最接近哪个网格位置
    const containers = Array.from(document.querySelectorAll('.image-container'));
    const currentIndex = Math.floor(newY / (GRID_CONFIG.cellHeight + GRID_CONFIG.gap)) * GRID_CONFIG.columns +
      Math.floor(newX / (GRID_CONFIG.cellWidth + GRID_CONFIG.gap));

    if (currentIndex !== element.originalIndex && currentIndex >= 0 && currentIndex < containers.length) {
      // 重新排序元素
      const oldIndex = element.originalIndex;
      const newIndex = currentIndex;

      // 更新 DOM 中的顺序
      const parent = element.parentNode;
      const elements = Array.from(parent.children);
      const elementToMove = elements[oldIndex];

      if (oldIndex < newIndex) {
        // 向后移动
        for (let i = oldIndex; i < newIndex; i++) {
          elements[i] = elements[i + 1];
        }
      } else {
        // 向前移动
        for (let i = oldIndex; i > newIndex; i--) {
          elements[i] = elements[i - 1];
        }
      }
      elements[newIndex] = elementToMove;

      // 清空容器
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }

      // 按新顺序重新添加元素
      elements.forEach(el => {
        if (el) parent.appendChild(el);
      });

      element.originalIndex = newIndex;
      updateGridLayout();
    }
  }

  function closeDragElement() {
    element.isDragging = false;
    element.style.zIndex = '';
    element.style.transition = 'transform 0.2s';

    // 更新最终位置
    updateGridLayout();

    document.onmouseup = null;
    document.onmousemove = null;
  }
}

async function mergeVertical() {
  const containers = document.querySelectorAll('.image-container');
  if (containers.length < 2) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 计算最大宽度和总高度
  let maxWidth = 0;
  const loadedImages = await Promise.all(Array.from(containers).map(container => {
    return new Promise((resolve) => {
      const img = container.querySelector('img');
      const newImg = new Image();
      newImg.onload = () => resolve(newImg);
      newImg.src = img.src;
    });
  }));

  // 先找出最大宽度
  loadedImages.forEach(img => {
    maxWidth = Math.max(maxWidth, img.width);
  });

  // 计算调整后的高度（保持比例）和总高度
  let totalHeight = 0;
  const scaledHeights = loadedImages.map(img => {
    const scale = maxWidth / img.width;
    const scaledHeight = img.height * scale;
    totalHeight += scaledHeight;
    return scaledHeight;
  });

  canvas.width = maxWidth;
  canvas.height = totalHeight;

  // 绘制图片
  let y = 0;
  loadedImages.forEach((img, index) => {
    const scale = maxWidth / img.width;
    const scaledHeight = scaledHeights[index];
    ctx.drawImage(img, 0, y, maxWidth, scaledHeight);
    y += scaledHeight;
  });

  showResult(canvas.toDataURL());
}

async function mergeHorizontal() {
  const containers = document.querySelectorAll('.image-container');
  if (containers.length < 2) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 计算最大高度
  let maxHeight = 0;
  const loadedImages = await Promise.all(Array.from(containers).map(container => {
    return new Promise((resolve) => {
      const img = container.querySelector('img');
      const newImg = new Image();
      newImg.onload = () => resolve(newImg);
      newImg.src = img.src;
    });
  }));

  // 先找出最大高度
  loadedImages.forEach(img => {
    maxHeight = Math.max(maxHeight, img.height);
  });

  // 计算调整后的宽度（保持比例）和总宽度
  let totalWidth = 0;
  const scaledWidths = loadedImages.map(img => {
    const scale = maxHeight / img.height;
    const scaledWidth = img.width * scale;
    totalWidth += scaledWidth;
    return scaledWidth;
  });

  canvas.width = totalWidth;
  canvas.height = maxHeight;

  // 绘制图片
  let x = 0;
  loadedImages.forEach((img, index) => {
    const scaledWidth = scaledWidths[index];
    ctx.drawImage(img, x, 0, scaledWidth, maxHeight);
    x += scaledWidth;
  });

  showResult(canvas.toDataURL());
}

function showResult(dataUrl) {
  const result = document.getElementById('result');
  result.innerHTML = `
    <img src="${dataUrl}">
    <div style="margin-top: 10px; color: #666;">
      提示：按 Ctrl+C 或 Command+C 可以复制拼接结果
    </div>
  `;
  lastMergedImage = dataUrl;
}

// 添加清空功能
function clearAll() {
  // 清空放置的图片
  dropzone.innerHTML = '将图片拖放到这里、粘贴图片或点击选择图片';

  // 清空拼接���果
  const result = document.getElementById('result');
  result.innerHTML = '';
  lastMergedImage = null;
}

// 添加显示帮助对话框的函数
function showHelp() {
  const dialog = document.getElementById('helpDialog');
  dialog.showModal();
}