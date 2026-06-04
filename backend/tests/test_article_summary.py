from __future__ import annotations

from app.services.article_summary import extract_content_for_summary


def test_empty_content():
    assert extract_content_for_summary("") == ""
    assert extract_content_for_summary("", 8000) == ""


def test_none_like_empty():
    assert extract_content_for_summary("", 8000) == ""


def test_short_content_under_limit():
    content = "Hello world"
    result = extract_content_for_summary(content, 8000)
    assert result == "Hello world"


def test_pure_text_no_paragraphs_fallback():
    content = "A" * 10000
    result = extract_content_for_summary(content, 8000)
    assert len(result) <= 8000
    assert result == "A" * 8000


def test_plain_text_paragraphs():
    content = "First paragraph intro.\n\nMiddle paragraph detail.\n\nLast paragraph conclusion."
    result = extract_content_for_summary(content, 8000)
    assert "First paragraph intro." in result
    assert "Last paragraph conclusion." in result


def test_html_paragraphs():
    content = "<p>First paragraph intro.</p><p>Middle detail.</p><p>Last conclusion.</p>"
    result = extract_content_for_summary(content, 8000)
    assert "First paragraph intro." in result
    assert "Last conclusion." in result


def test_long_content_trims_middle():
    first = "A" * 800
    middle1 = "B" * 2000
    middle2 = "C" * 2000
    last = "D" * 800
    content = f"{first}\n\n{middle1}\n\n{middle2}\n\n{last}"
    result = extract_content_for_summary(content, 2000)
    # first and last should be fully preserved when budget allows
    assert result.startswith(first)
    assert result.endswith(last)
    assert len(result) <= 2000


def test_first_sentence_extraction():
    content = (
        "Intro paragraph.\n\n"
        "This is the first sentence. This is the second sentence.\n\n"
        "Conclusion paragraph."
    )
    result = extract_content_for_summary(content, 8000)
    assert "Intro paragraph." in result
    assert "Conclusion paragraph." in result
    assert "first sentence." in result


def test_cjk_first_sentence():
    content = (
        "这是一个引言段落。\n\n"
        "这是第一句话。这是第二句话。\n\n"
        "这是结论段落。"
    )
    result = extract_content_for_summary(content, 8000)
    assert "引言段落" in result
    assert "结论段落" in result
    assert "第一句话" in result


def test_single_paragraph_fallback():
    content = "Just one long paragraph with no breaks at all."
    result = extract_content_for_summary(content, 8000)
    assert result == content


def test_max_chars_zero():
    assert extract_content_for_summary("hello", 0) == ""


def test_html_tags_stripped():
    content = "<p>Hello <b>world</b></p><p>Second para</p>"
    result = extract_content_for_summary(content, 8000)
    assert "<b>" not in result
    assert "<p>" not in result
    assert "Hello world" in result


def test_output_never_exceeds_max_chars():
    """Separator overhead must be accounted for so output <= max_chars."""
    first = "A" * 3990
    last = "D" * 3990
    middle_parts = [f"M{i}." for i in range(50)]
    content = first + "\n\n" + "\n\n".join(middle_parts) + "\n\n" + last
    result = extract_content_for_summary(content, 8000)
    assert len(result) <= 8000
