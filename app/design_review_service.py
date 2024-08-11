# design_review_service.py

from bson import ObjectId
from datetime import datetime
from flask import current_app
from .utils import get_collection, analyze_transcript

class DesignReviewService:
    @staticmethod
    def get_review(review_id):
        design_reviews_collection = get_collection('design_reviews')
        return design_reviews_collection.find_one({'_id': ObjectId(review_id)})

    @staticmethod
    def update_review(review_id, update_data):
        design_reviews_collection = get_collection('design_reviews')
        result = design_reviews_collection.update_one(
            {'_id': ObjectId(review_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0

    @staticmethod
    def delete_review(review_id):
        design_reviews_collection = get_collection('design_reviews')
        result = design_reviews_collection.delete_one({'_id': ObjectId(review_id)})
        return result.deleted_count > 0

    @staticmethod
    def get_all_reviews():
        design_reviews_collection = get_collection('design_reviews')
        return list(design_reviews_collection.find())

    @staticmethod
    def create_review(review_data):
        design_reviews_collection = get_collection('design_reviews')
        result = design_reviews_collection.insert_one(review_data)
        return str(result.inserted_id)

    @staticmethod
    def update_transcript_path(review_id, file_path):
        return DesignReviewService.update_review(review_id, {'transcription_path': file_path})

    @staticmethod
    def update_review_analysis(review_id, analysis_result):
        update_data = {
            'what_we_heard': analysis_result.get('what_we_heard'),
            'key_issues': analysis_result.get('key_issues'),
            'what_we_advise': analysis_result.get('what_we_advise')
        }
        return DesignReviewService.update_review(review_id, update_data)

    @staticmethod
    def analyze_transcript(review_id, file_path):
        review = DesignReviewService.get_review(review_id)
        if not review:
            return None
        user_context = f"Application Status: {review.get('application_status', 'N/A')}, Skill Level: {review.get('skill_level', 'N/A')}"
        return analyze_transcript(file_path, user_context)