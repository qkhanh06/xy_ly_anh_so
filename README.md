# PixelLab — Học hiểu, nhớ lâu

Website tự học **Xử lý ảnh số** bằng HTML, CSS và JavaScript thuần. Gồm **83 câu hỏi, 12 chủ đề**, không cần tài khoản, API key hoặc backend.

## Các chức năng

- **Trắc nghiệm:** phản hồi đúng/sai, đáp án và giải thích ngay sau khi chọn; thống kê kết quả cuối buổi.
- **Flashcard:** tự nhớ trước khi lật thẻ, đánh giá “Chưa nhớ”, “Hơi khó”, “Đã nhớ”. Tự đánh giá flashcard không làm thay đổi tỷ lệ đúng trắc nghiệm.
- **Ôn cách quãng:** chưa nhớ hoặc trả lời sai → 10 phút; hơi khó → 1 ngày; nhớ/đúng liên tiếp → 1, 3, 7, 14, 30 ngày (tối đa 30). Câu đến hạn xuất hiện trong “Đến lịch ôn”; không có thông báo ngoài trình duyệt.
- **Buổi học linh hoạt:** 10, 20 hoặc toàn bộ câu; lọc theo chủ đề, nguồn, câu cần luyện, câu đã lưu, câu chưa học hoặc lịch ôn.
- **Sổ tay cá nhân:** đánh dấu sao, ghi chú cách nhớ, tìm kiếm và ôn lại từng câu.
- **Tiến độ:** kết quả theo chủ đề, biểu đồ 7 ngày, chuỗi ngày học, mục tiêu 5/10/20 câu khác nhau mỗi ngày. Làm lại cùng một câu trong ngày chỉ tính một lần vào mục tiêu.
- **Sao lưu/khôi phục JSON:** chuyển tiến độ giữa các thiết bị. Nhập bản sao lưu sẽ yêu cầu xác nhận thay thế dữ liệu hiện tại.
- **Giao diện sáng/tối**, thích ứng điện thoại và máy tính, điều khiển bàn phím và hỗ trợ giảm chuyển động.
- Tự đọc lịch sử `pixellab-quiz-v1` của phiên bản cũ **trên cùng trình duyệt và cùng địa chỉ website**. Các câu cũ được đưa vào lịch ôn ban đầu.

## Chạy tại máy

Mở `index.html` trực tiếp, hoặc chạy máy chủ tĩnh để có địa chỉ lưu dữ liệu nhất quán:

```sh
python -m http.server 8000
```

Truy cập `http://localhost:8000`. Đổi tên miền, cổng hoặc trình duyệt sẽ sử dụng vùng lưu trữ khác; hãy xuất bản sao lưu để chuyển tiến độ.

## Đưa lên GitHub Pages

Repository: `qkhanh06/xy_ly_anh_so`.

Trong **Settings → Pages → Build and deployment**, chọn **Deploy from a branch**, nhánh **main**, thư mục **/(root)** và **Save**. Website tĩnh không cần bước build. Địa chỉ dự kiến sau khi bật Pages là `https://qkhanh06.github.io/xy_ly_anh_so/`.

## Cách học gợi ý

1. Chọn một chủ đề và buổi học 10 câu.
2. Đọc lời giải, ghi lại điều hay nhầm bằng lời của bạn.
3. Dùng flashcard để tự nhớ, đánh giá đúng mức độ nhớ của mình.
4. Mỗi ngày mở “Đến lịch ôn” trước khi học câu mới.
5. Xem tiến độ theo chủ đề để chọn phần cần tập trung.

Phím **1–4** chọn đáp án. **Enter** tiếp tục sau khi trả lời hoặc lật flashcard; khi đang đặt con trỏ trên nút, Enter kích hoạt nút đó. Phím tắt không can thiệp khi đang nhập ghi chú hoặc chọn bộ lọc.

## Cấu trúc

- `index.html`: giao diện và cấu trúc truy cập.
- `styles.css`: giao diện, hình minh họa CSS, responsive, sáng/tối.
- `app.js`: học tập, lịch ôn, sổ tay, thống kê và lưu dữ liệu.
- `questions.js`: ngân hàng câu hỏi và lời giải gốc.
- `favicon.svg`: biểu tượng website.
- `tests/browser-checks.js`: kiểm thử các luồng học bằng Playwright CLI.

Mỗi câu có dạng `[câu_hỏi, [A,B,C,D], vị_trí_đúng_0_đến_3, giải_thích, nguồn, chủ_đề]`. **Chỉ thêm câu mới ở cuối mảng**, vì vị trí câu là mã định danh của lịch sử hiện tại. Đổi thứ tự hoặc xóa câu cần di chuyển dữ liệu tương ứng. Chỉ bổ sung câu đã kiểm tra đáp án.

## Kiểm thử

Với máy chủ ở cổng 8000 và Playwright CLI đã cài:

```sh
node --check app.js
playwright-cli open http://localhost:8000
playwright-cli run-code --filename=tests/browser-checks.js
playwright-cli eval 'window.__testResult'
```

Bộ kiểm thử dùng hồ sơ trình duyệt kiểm thử, xóa dữ liệu trên origin localhost trong hồ sơ đó, kiểm tra trả lời đúng/sai, lịch ôn, flashcard, ghi chú an toàn, tìm kiếm, bộ lọc, mục tiêu, lưu giao diện, xuất/nhập, dữ liệu cũ và tràn ngang ở các độ rộng 320/390/768/1440px. Đợi quá trình chạy hoàn tất rồi đọc `window.__testResult` nếu CLI tạm trả về khi gặp hộp thoại xác nhận.

Kiểm tra bổ sung lịch ôn 3–7–14–30 ngày, phím tắt và lỗi lưu trữ bằng `playwright-cli run-code --filename=tests/edge-checks.js`, rồi đọc `window.__edgeResult`. Bài kiểm tra này mô phỏng trình duyệt chặn lưu trữ; đóng phiên kiểm thử bằng `playwright-cli close` sau khi chạy.

## Nguồn biên soạn

- PDF do người sử dụng cung cấp: _Trắc nghiệm về Xử Lý Ảnh — Môn Học CNTT101_, 35 trang.
- Scribd: [TRẮC NGHIỆM XỬ LÝ ẢNH SỐ STUDOCU](https://www.scribd.com/document/1062382689/TR%E1%BA%AEC-NGHI%E1%BB%86M-X%E1%BB%AC-L%C3%9D-%E1%BA%A2NH-S%E1%BB%90-STUDOCU), 9 trang.

Câu hỏi đã được biên soạn/diễn đạt lại thành bộ luyện tập và bổ sung lời giải ngắn. Không sao chép nguyên văn toàn bộ tài liệu. Các câu cần ảnh minh họa không đủ dữ liệu đã bỏ qua. Đây là bộ ôn luyện độc lập, không phải đáp án được nhà trường chứng nhận. Một số chủ đề ở hai nguồn trùng nhau nên có câu gần giống nhau để ôn tập.

## Quyền riêng tư và giới hạn

Tiến độ, ghi chú và câu đã lưu nằm trong `localStorage` trên thiết bị; không gửi lên máy chủ. Xóa dữ liệu trình duyệt sẽ làm mất tiến độ nếu chưa sao lưu. Nếu trình duyệt chặn lưu trữ, ứng dụng thông báo và vẫn cho học trong phiên hiện tại. Google Fonts cung cấp phông chữ; khi không tải được, website dùng phông hệ thống. Nội dung câu hỏi được giữ từ bộ ban đầu, chưa được đối chiếu lại với tài liệu nguồn trong lần nâng cấp giao diện này.
